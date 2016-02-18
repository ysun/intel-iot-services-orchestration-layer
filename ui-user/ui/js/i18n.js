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
import I18n from "i18next/lib/i18next";
import LngDetector from "i18next-browser-languagedetector/lib";

I18n.use(LngDetector).init({
  detection: {
    order: ['navigator'],
  },
  resources: {
    "zh": {
      translation: require("./lang.zh")
    },
    "zh-CN": {
      translation: require("./lang.zh-cn")
    }
  }
});


var brlang = I18n.language;

module.exports = function(msg, langres) {
  if (!_.isString(msg)) {
    return "";
  }

  if (arguments.length === 2) {
    if (!_.isObject(langres) || !_.isObject(langres[brlang])) {
      return msg;
    }

    return langres[brlang][msg] || msg;
  }

  return I18n.t(msg, {
    keySeparator: "\v", // bypass namespace
    nsSeparator: "\v",  // bypass namespace
    defaultValue: msg
  });
};

