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
import class_names from "classnames";

export default class Edge extends ReactComponent {

  static propTypes = {
    view: React.PropTypes.object.isRequired,
    id: React.PropTypes.string.isRequired
  };

  _is_selected() {
    return this.props.view.is_selected("edge", this.props.id);
  }

  _is_animated() {
    return this.props.view.is_animated("edge", this.props.id);
  }

  _on_click(e) {
    e.stopPropagation();
    // Prevent screen blink
    if (!e.ctrlKey && this._is_selected()) {
      return;
    }
    $hope.trigger_action("graph/select/edge", {
      graph_id: this.props.view.id, 
      id: this.props.id,
      is_multiple_select: e.ctrlKey
    });
  }

  render() {
    var view = this.props.view;
    var edge = view.get("edge", this.props.id);
    var s = view.get_outport_position(edge.source);
    var t = view.get_inport_position(edge.target);
    var styles = edge.$get_styles() || {};
    var extract;

    t.x -= $hope.config.graph.inport_line_length;

    // Organic / curved edge
    var CURVE = $hope.config.graph.node_size.width;
    var c1X, c1Y, c2X, c2Y;
    if (t.x - 5 < s.x) {
      var curveFactor = (s.x - t.x) * CURVE / 200;
      if (Math.abs(t.y - s.y) < CURVE / 2) {
        // Loopback
        c1X = s.x + curveFactor;
        c1Y = s.y - curveFactor;
        c2X = t.x - curveFactor;
        c2Y = t.y - curveFactor;
      } else {
        // Stick out some
        c1X = s.x + curveFactor;
        c1Y = s.y + (t.y > s.y ? curveFactor : -curveFactor);
        c2X = t.x - curveFactor;
        c2Y = t.y + (t.y > s.y ? -curveFactor : curveFactor);
      }
    } else {
      // Controls halfway between
      c1X = s.x + (t.x - s.x) / 2;
      c1Y = s.y;
      c2X = c1X;
      c2Y = t.y;
    }

    var path = [
        "M", s.x, s.y,
        "C", c1X, c1Y, c2X, c2Y, t.x, t.y
        ].join(" ");
    
    if ("field" in edge) {
      var cx = (s.x + t.x) / 2;
      var cy = (s.y + t.y) / 2;
      var w = (edge.field.length + 1) * 7.4;
      w = w < 42 ? 42 : w;
      extract = (
        <g className={"hope-graph-extract" + $hope.color(styles.color, "stroke")}>
          <rect x={cx - w / 2} y={cy - 5} rx={3} ry={3} width={w} height={15} />
          <text x={cx} y={cy + 6}>{edge.field}</text>
        </g>
      );
    }

    return (
      <g onClick={this._on_click}
        className={class_names("hope-graph-edge",
          {"hope-graph-selected": this._is_selected()},
          {"animated": this._is_animated()}
        )} >
        <path className={(edge.no_store ? "hope-graph-dash" : "") + $hope.color(styles.color, "stroke", "hover")} d={path} />
        {extract}
      </g>
    );
  }
}
