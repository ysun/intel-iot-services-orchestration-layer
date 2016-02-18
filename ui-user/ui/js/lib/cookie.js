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
const HOPE = "HOPE_";

exports.remove = function(k) {
  document.cookie = HOPE + k + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
};

exports.set = function(k, v, expires) {
  var d = new Date();
  d.setTime(d.setTime() + expires);
  document.cookie = HOPE + k + "=" + encodeURIComponent(v) + (!expires ? "" : ";expires=" + d.toGMTString());
};

exports.get = function(key) {
  var cs = document.cookie;
  if (cs.length > 0) {
    var k = HOPE + key + "=";
    var sidx = cs.indexOf(k);
    if (sidx !== -1) {
      sidx += k.length;
      var eidx = cs.indexOf(";", sidx);
      if (eidx === -1) {
        eidx = cs.length;
      }
      return decodeURIComponent(cs.substring(sidx, eidx));
    } 
  }
  return "";
};
