/******************************************************************************
Copyright (c) 2015, Intel Corporation

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of Intel Corporation nor the names of its contributors
      may be used to endorse or promote products derived from this software
      without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*****************************************************************************/
var B = require("hope-base");
var P = require("hope-hub-center-shared").protocol;
var log = B.log.for_category("center");
var _ = require("lodash");
var FE = require("./frontend");
var HeartBeatServer = require("./heartbeat_server");
var BuiltinHub = require("./built_in_hub");

var Center =
module.exports = function(config) {
  config = config || {};
  this.type = "Center";
  this.id = config.id || B.unique_id("HOPE_CENTER_");
  this.name = config.name || this.id;
  this.description = config.description || this.name;
  this.mnode = B.check(config.mnode, "center", "Should have a mnode to create");
  this.em = B.check(config.entity_manager, 
    "center", "Should have a entity_manager to create");
  this.config = config;
  this.config_path = config.config_path;
  B.check(config.appbundle_path, "center", "should have an app bundle");
  this.appbundle_path = B.path.abs(config.appbundle_path, this.config_path);
  this.frontends = {};

  if (config.dev_web_app) {
    this.frontends.dev = new FE.DevFrontEnd(this, config.dev_web_app);
  }
  if (config.user_web_app) {
    this.frontends.user = new FE.UserFrontEnd(this, config.user_web_app);
  }

  if (this.frontends.dev) {
    this.frontends.dev.$forward = this.frontends.user;
  }

  if (config.heartbeat_server) {
    this.heartbeat_server = new HeartBeatServer(this, config.heartbeat_server); 
  }

  this.built_in_hub = null;
  this.workflow_engine = config.workflow_engine;

};

Center.create$ = function(config) {
  var center = new Center(config);
  return center.init$().then(function() {
    return center;
  });
};

Center.prototype.get_info = function() {
  return {
    id: this.id,
    mnode_id: this.mnode.id
  };
};

Center.prototype.get_brief = function() {
  return {
    id: this.id,
    mnode_id: this.mnode.id
  };
};


Center.prototype.init$ = function() {
  var tasks = [];
  var self = this;
  tasks.push(this._init_em$());
  tasks.push(this.mnode.accept$(P.EM_FULLINFO, this.on_entities_fullinfo.bind(this)));
  tasks.push(this.mnode.accept$(P.CLAIM_AS_HUB, this.on_hub_claimed.bind(this)));
  tasks.push(this.mnode.subscribe_all$(P.CLAIM_AS_HUB, this.on_hub_claimed.bind(this)));
  tasks.push(this.mnode.subscribe_all$(P.HUB_LEAVE, this.on_hub_left.bind(this)));
  tasks.push(this._init_frontends$());

  return Promise.all(tasks).then(function() {
    if (self.heartbeat_server) {
      self.heartbeat_server.enable();
    }
    return self.mnode.publish$(P.CLAIM_AS_CENTER, self.get_info()); 
  }).then(function() {
    return BuiltinHub.create$(self).then(function(hub) {
      self.built_in_hub = hub; 
      return BuiltinHub.init$(hub, self);
    });
  }).then(function() {
    return self.mnode.enable_rpc$(); 
  });
};


Center.prototype.leave$ = function() {
  var self = this;

  return this.built_in_hub.leave$()
  .then(function() {
    self.mnode.disable_rpc$();
  })
  .then(function() {
    if (self.heartbeat_server) {
      self.heartbeat_server.disable();
    }
    var tasks = [];
    tasks.push(self.mnode.publish$(P.CENTER_LEAVE, self.get_brief()));
    tasks.push(self.mnode.clean_subscribe_all$());
    tasks.push(self.mnode.clean_subscribe$());
    tasks.push(self.mnode.clean_accepts$());
    return Promise.all(tasks);
  }).then(function() {
    self.destroy_related_webapp();
  });
};

Center.prototype.destroy_related_webapp = function() {
  if (this.config.user_web_app) {
    this.config.user_web_app.$destroy();
  }
  if (this.config.dev_web_app) {
    this.config.dev_web_app.$destroy();
  }
  this.mnode.destroy_its_webapp();
};

Center.prototype.on_hub_claimed = function(hub_info) {
  log("Hub Claimed", hub_info);
  var self = this;
  var hub_id = hub_info.id;
  var hub_mnode_id = hub_info.mnode_id;
  self.beat$(hub_id).done();//beat
  this.make_lock(hub_id).lock_as_promise$(function() {
    return self.em.hub__get$(hub_id)
    .then(function(hub) {
      if (_.isUndefined(hub)) {
        log("Found New Hub", hub_info);
        var tasks = [];
        tasks.push(self.mnode.subscribe$(hub_mnode_id, P.EM_CHANGED, self.on_entities_changed.bind(self)));
        tasks.push(self.mnode.send$(hub_mnode_id, P.NEED_EM_FULLINFO, self.get_info()));
        
        return Promise.all(tasks);
      }
    });
  }).done();
};

Center.prototype.force_hub_leave = function(hub_id) {
  var self = this;
  this.make_lock(hub_id).lock_as_promise$(function() {
    return self.em.hub__get$(hub_id).then(function(hub) {
      if (hub) {
        self.on_hub_left({
          id: hub_id,
          mnode_id: hub.mnode
        });
      }
    });
  }).done();
};

Center.prototype.on_hub_left = function(hub_brief) {
  log("Hub Left", hub_brief);
  var self = this;
  this.make_lock(hub_brief.id).lock_as_promise$(function() {
    return self.em.hub__remove$(hub_brief.id)
    .then(function() {
      if (self.heartbeat_server) {
        return self.heartbeat_server.leave$(hub_brief.id);
      }
    })
    .then(function() {
      var tasks = [];
      tasks.push(self.mnode.clean_subscribe$(hub_brief.mnode_id));
      return Promise.all(tasks);
    });
  }).done();
};

Center.prototype.on_entities_changed = function(data) {
  var hub_id = data.hub;
  var hub_mnode_id = data.hub_mnode_id;
  var list = data.list;
  var time = data.time;
  var self = this;
  self.beat$(hub_id).done();//beat
  log("EM_CHANGED From Hub", hub_id, data);
  this.make_lock(hub_id).lock_as_promise$(function() {
    return self.em.hub__get$(hub_id)
    .then(function(hub) {
      if (_.isUndefined(hub)) {
        log("EM_CHANGED hub not exist", hub_id);
        return self.mnode.send$(hub_mnode_id, P.NEED_EM_FULLINFO, self.get_info());
      }
      else if (check_emchanged_time_match(time, hub.timestamp)) {
        log("EM_CHANGED match", hub_id, time, "existing timestamp:", hub.timestamp);
        return self.em.update$(list)
        .then(function() {
          return self.em.hub__get$(hub_id);
        })
        .then(function(new_hub) {
          return self._set_hub_timestamp$(new_hub, time);
        });
      }
      else if (check_emchanged_time_new(time, hub.timestamp)) {
        log("EM_CHANGED ahead", hub_id, time, "existing timestamp:", hub.timestamp);
        return self.mnode.send$(hub_mnode_id, P.NEED_EM_FULLINFO, self.get_info());
      }
      else {
        log("EM_CHANGED old", hub_id, time, "existing timestamp:", hub.timestamp);
        return; 
      }
    });
  }).done();
};

Center.prototype.on_entities_fullinfo = function(data) {
  var hub_id = data.hub;
  var list = data.list;
  var time = data.time;
  var self = this;
  self.beat$(hub_id).done();//beat
  log("EM_FULLINFO From Hub", hub_id);
  this.make_lock(hub_id).lock_as_promise$(function() {
    return self.em.hub__get$(hub_id)
    .then(function(hub) {
      if (_.isUndefined(hub)) {
        log("FULLINFO of New Hub", hub_id, time);
        return self.em.update$(list)
        .then(function() {
          return self.em.hub__get$(hub_id);
        })
        .then(function(new_hub) {
          return self._set_hub_timestamp$(new_hub, time);
        });
      }
      else if (check_fullinfo_time(time, hub.timestamp)) {
        log("FULLINFO of Existing Hub", hub_id, time, "existing timestamp:", hub.timestamp);
        return self.em.hub__remove$(hub_id)
        .then(function() {
          return self.em.update$(list);
        })
        .then(function() {
          return self._set_hub_timestamp$(hub, time);
        });
      }
      else {
        log("Old FULLINFO", hub_id, time, "existing timestamp:", hub.timestamp);
        return;
      }
    });
  }).done();
};

Center.prototype._ensure_user_exists$ = function(user, role, passwd) {
  var self = this;
  return self.em.user__find$(user, null).then(function(u) {
    if (u) {
      return false;
    }
    self.em.user__add$({
      id: user,
      name: user,
      role: role,
      passwd: passwd,
      appbundle_path: B.path.join(self.appbundle_path, user)
    });
    return true;
  });
};

Center.prototype._init_em$ = function() {
  var self = this;
  if (this.config.auth) {
    // default password is ""
    return self._ensure_user_exists$("admin", "admin", "LcCbizWvnANvw/Kc28Bfuw==").then(function(added) {
      if (!added) {
        // guest can be deleted
        return Promise.resolve();
      }
      return self._ensure_user_exists$("guest", "guest", "7lf26KynsWJIvOEM9QWHVQ==");
    });
  }
  return self.em.app__load_from_bundle$(self.appbundle_path, null);
};

Center.prototype._set_hub_timestamp$ = function(hub, timestamp) {
  hub.timestamp = timestamp;
  return this.em.hub_store.set$(hub.id, hub);
};

Center.prototype._init_frontends$ = function() {
  var tasks = [];

  if (this.frontends.dev) {
    tasks.push(this.frontends.dev.init$());
  }
  if (this.frontends.user) {
    tasks.push(this.frontends.user.init$());
  }
  return Promise.all(tasks);
};

Center.prototype.make_lock = function(key) {
  return B.lock.make("__HOPE__/CENTER/" + this.id + "/" + 
    (_.isUndefined(key) ? "" : key)); 
};

Center.prototype.beat$ = function(hub_id) {
  var self = this;
  return Promise.resolve()
  .then(function() {
    if (self.heartbeat_server) {
      return self.heartbeat_server.beat$(hub_id);
    }
  });
};
// -----------------------------------------------
// Workflow related. all lock the graph_id. 
//              each operation is atomic
// -----------------------------------------------
Center.prototype.workflow_start$ = function(graph_id, tracing) {
  log("workflow_start", graph_id);
  var self = this;
  var graph;
  return this.make_lock(graph_id).lock_as_promise$(function() {
    return self.em.graph__get$(graph_id)
    .then(function(graph_json) {
      var specid_array = [];
      graph_json.graph.nodes.forEach(function(node) {
        specid_array.push(node.spec);
      });
      graph = graph_json;
      return self.em.spec__get$(specid_array);
    })
    .then(function(specs) {
      // The specs we got from database is an array
      // However, the engine expects a hashtable for the specs 
      // so need index it first
      return self.workflow_engine.start$(graph, 
        _.indexBy(specs, "id"), tracing).then(function() {
        });
    });
  });
};

Center.prototype.workflow_get_status = function(graph_id) {
  // need to interpret internal status to external
  switch (this.workflow_engine.get_status(graph_id)) {
    case "unloaded": 
      return "Non-exist";
    case "enabled":
      return "Working";
    case "disabled":
      return "Paused";
    case "installed":
      return "Stopped";
    case "loaded":
      return "Idle";
  }
};

Center.prototype.workflow_get_trace = function(graph_id) {
  log("workflow_get_trace", graph_id);
  return this.workflow_engine.get_trace(graph_id);
};

Center.prototype.workflow_stop$ = function(graph_id) {
  log("workflow_stop", graph_id);
  var self = this;
  return this.make_lock(graph_id).lock_as_promise$(function() {
    return self.workflow_engine.stop$(graph_id);
  });
};

Center.prototype.workflow_pause$ = function(graph_id) {
  log("workflow_pause", graph_id);
  var self = this;
  return this.make_lock(graph_id).lock_as_promise$(function() {
    return self.workflow_engine.pause$(graph_id);
  });
};

Center.prototype.workflow_resume$ = function(graph_id) {
  log("workflow_resume", graph_id);
  var self = this;
  return this.make_lock(graph_id).lock_as_promise$(function() {
    return self.workflow_engine.resume$(graph_id);
  });
};


// -------------------------------------------------
// Helper
// -------------------------------------------------
function check_fullinfo_time(coming_time, existing_time) {
  return B.time.compare_hrtime(coming_time.now, existing_time.now) === 1;
}

function check_emchanged_time_match(coming_time, existing_time) {
  return B.time.compare_hrtime(coming_time.last, existing_time.now) === 0;
}


function check_emchanged_time_new(coming_time, existing_time) {
  return B.time.compare_hrtime(coming_time.now, existing_time.now) === 1;
}

// -------------------------------------------------
// rpc invoke
// -------------------------------------------------

Center.prototype.add_hope_thing$ = function(thing) {
  var self = this;
  return this.em.hub__get$(thing.hub)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "add_hope_thing", thing);
  })
  .then(function(data) {
    self.on_entities_changed(data);
    return;
  });
};

Center.prototype.update_hope_thing$ = function(thing) {
  var self = this;
  return this.em.thing__get_hub$(thing.id)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "update_hope_thing", thing);
  })
  .then(function(data) {
    self.on_entities_changed(data);
    return;
  });
};

Center.prototype.remove_hope_thing$ = function(thing_id) {
  var self = this;
  return this.em.thing__get_hub$(thing_id)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "remove_hope_thing", thing_id);
  })
  .then(function(data) {
    self.on_entities_changed(data);
    return;
  });
};

Center.prototype.add_hope_service$ = function(service) {
  var self = this;
  return this.em.thing__get_hub$(service.thing)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "add_hope_service", service);
  })
  .then(function(data) {
    self.on_entities_changed(data);
    return;
  });
};

Center.prototype.update_hope_service$ = function(service) {
  var self = this;
  return this.em.service__get_hub$(service.id)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "update_hope_service", service);
  })
  .then(function(data) {
    self.on_entities_changed(data);
    return;
  });
};

Center.prototype.remove_hope_service$ = function(service_id) {
  var self = this;
  return this.em.service__get_hub$(service_id)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "remove_hope_service", service_id);
  })
  .then(function(data) {
    self.on_entities_changed(data);
    return;
  });
};

Center.prototype.list_service_files$ = function(service_id) {
  var self = this;
  return this.em.service__get_hub$(service_id)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "list_service_files", service_id);
  });
};

Center.prototype.read_service_file$ = function(service_id, file_path) {
  var self = this;
  return this.em.service__get_hub$(service_id)
  .then(function(hub) {
    return self.mnode.invoke_rpc$(hub.mnode, "read_service_file", [service_id, file_path]);
  });
};

Center.prototype.write_service_file$ = function(service_id, file_path, content) {
  var self = this;
  var hub;
  B.check(!self.workflow_engine.has_started_workflows(), "center",
    "there still has started workflows, cannnot write_service_file");
  return this.em.service__get_hub$(service_id)
  .then(function(_hub) {
    hub = _hub;
    return self.mnode.invoke_rpc$(hub.mnode, "write_service_file", [service_id, file_path, content]);
  })
  .then(function() {
    return self.mnode.invoke_rpc$(hub.mnode, "reload_service", service_id);
  });
};

Center.prototype.remove_service_file$ = function(service_id, file_path) {
  var self = this;
  var hub;
  B.check(!self.workflow_engine.has_started_workflows(), "center",
    "there still has started workflows, cannnot remove_service_file");
  return this.em.service__get_hub$(service_id)
  .then(function(_hub) {
    hub = _hub;
    return self.mnode.invoke_rpc$(hub.mnode, "remove_service_file", [service_id, file_path]);
  })
  .then(function() {
    return self.mnode.invoke_rpc$(hub.mnode, "reload_service", service_id);
  });

};