/*
 * Simple JSON parser which does not rely on eval
 * Copyright (c) 2011 Mark Watkinson <markwatkinson@gmail.com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the <organization> nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL MARK WATKINSON BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * @param {string} json
 * @param {Array=} errors
 * @return {*}
 */
function readJson(json, errors) {  
  var parsed = null,
      i = 0,
      lineno = 1,
      charno = 1,
      stack = [];
  errors = (typeof errors === 'undefined')? [] : errors;
      

  function log_(scope, msg) {
    return; // kind of obsolete with error()
    if (typeof console !== 'undefined' && typeof console.log !== 'undefined') {
      console.log(scope + ': ' + msg);
    }
  }
  
  function error(desc, level) {
    var err = {desc: desc, charno: charno, lineno:lineno, level:level};
    errors.push(err);
  }
  
  errors.toString = function() {
    var s = '';
    for (var i=0; i<errors.length; i++) {
      var e = errors[i];
      s += e.lineno + ':' + e.charno + ' ' + e.desc + '\n';
    }
    return s;
  };  
  
  function push(type) {
    stack.push({type: type, lineno: lineno, charno: charno});
  }
      
  function get() {
    if (i < json.length) {
      var c = json.charAt(i++);
      if ( c === '\r' || 
          (c === '\n' && i > 0 && json.charAt(i-1) !== '\r') ) { 
        lineno++;
        charno = 1;
      } else {
        charno++;
      }
      return c;
    }
    return false;
  }
  /**
   * @param {number=} length
   */
  function peek(length) {
    length = (typeof length === 'undefined' || length < 1)? 1 : length;
    if (i < json.length) {
      return json.substr(i, length);
    } else {
    return false;
    }
  }
  
  // maybe these are cheating
  function isspace(c) {
    return (c === ' ' || c === '\t' || c === '\f' || c === '\r' || c === '\n');    
  }  
  function isdigit(c) {
    var cc = c.charCodeAt(0);
    return (cc >= 48 && cc <= 57);
  }
  function isalpha(c) {
    var cc = c.charCodeAt(0);
    return ( (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122))
  }
  
  // consumes whitespace
  function whitespace() {
    var c = peek();
    while(c !== false && isspace(c)) {
      get();
      c = peek();
    }
  }
  
  // Reads a 'key' of an object. This should be enclosed in strings but for 
  // JS compat we also allow alphanumerics
  function key() {
    
    var c, key = null;
    whitespace();
    c = peek();
    if (c === '"' || c === "'") {
      return str();
    }
    
    while ((c = peek()) !== false) {
      if (isalpha(c) || isdigit(c) || c === '_') {
        if (key === null) key = c;
        else  key += c;
        get();
      }
      else break;
    }
    if (key === null) {
      error('Expected to find key, instead found: "' + get() + '"', 1);
      return;
    } else {
      error('Key "' + key + '" should be wrapped in double quotes', 0);
    }
    return key;
  }
  
  function str() {
    var ret = '',
        c,
        quote = get();
    push('String');
    if (quote !== '"') {
      error('Illegal string delimiter: ' + quote, Number(quote !== '\''));
    }
      
    while ((c = get()) !== false) {
      if (c === '\\') {
        var lookahead = get();
        var append = '';
        switch(lookahead) {
          
          // strip the slash from these
          case quote:  //fallthrough
          case '\\':   // ....
          case '/':    
            append = lookahead;
            break;
          // these are real escape sequences which we need to encode
          // into the string
          case 'b':
            append = '\b';
            break;
          case 'f':
            append = '\f';
            break;
          case 'n':
            append = '\n';
            break;
          case 'r':
            append = '\r';
            break;
          case 't':
            append = '\t';
            break;
          case 'u':
            // unicode. To build this here we need to look at the next four 
            // chars. Interestingly just leaving '\u' and concatenating the
            // sequence seems to pass Chrome and Firefox but IE doesn't like it.
            var hex = peek(4);
            var hex_ = '';
            for (var i=0; i<hex.length; i++) {
              if (!(/[a-fA-F0-9]/.test(hex.charAt(i)))) {
                error('Expected hex digit, found: "' + hex.charAt(i) + '"', 0);
                break;
              }
              hex_ += get();
            }
            append = String.fromCharCode( parseInt(hex_, 16) );            
            break;
          default:
            error('Unrecognised escape sequence: \\' + lookahead, 0);
            append = c + lookahead;
            break;
        }
        ret += append;
      }
      else if (c === quote) {
        stack.pop();
        break;
      }
      else ret += c;
    }
    log_('str', 'Got string "' + ret + '"');
    return ret;
  }
  
  function num() {
    var n = '', sign=false, digit = false, point = false, e = false,
      e_sign = false;
    var c;
    while ((c = peek()) !== false) {
      whitespace();
      c = peek();
      if (c === false)
        break;
      if (c == '-' || c == '+') {
        if (!sign && !digit) sign = true;
        else if(!e_sign && e) e_sign = true;
        else {
          error('Unexpected sign: ' + c, 1);
          break;
        }
      }
      else if (isdigit(c)) 
        digit = true;
      else if (c == '.') {
        if (!point) point = true;
        else {
          error('Unexpected point: ' + c, 1);
          break;
        }
      }
      else if (c == 'e' || c == 'E') {
        if (!e) e = true;
        else {
          error('Unexpected symbol: ' + e, 1);
          break;
        }
      }
      else {
        if (!digit) {
          // this probably shouldn't be here.
          var others = ['Infinity', 'NaN'];
          var match = null;
          for (var i=0; i<others.length && match === null; i++) {
            if (peek(others[i].length) === others[i])
              match = others[i];
          };
          if (match !== null) {
            n += match;
            error('Numeric type "' + n + '" is not valid JSON', 0);            
            for (var i=0; i<match.length; i++) 
              get();
          }
        }
        break;
      };
      n += c;
      get(); 
    }
    if (!n.length) {
      error('Expected to find number, but none found', 1);
      get();
      return;
    }
    return Number(n);
  }
  
  // Reads a literal type, i.e. true, false or null
  function literal() {
    var c;
    var x = '';
    whitespace();
    while((c = peek()) !== false) {
      if (!isalpha(c))
        break;
      x += c;
      get();
    }
    if (x === 'false')
      return false;
    else if (x === 'true')
      return true;
    else if (x === 'null')
      return null;
    
    if (!x.length) {
      error('Expected to find type literal but none found', 1);
      x = get();
    } else {    
      log_('literal', 'Invalid type literal: ' + x);
      error('Unrecognised symbol: "' + x + '"', 1);
    }
    return;
  }
  
  // Catch all. Everything's a value. This is the highest level function.
  function value() {
    var c;
    whitespace();
    while((c = peek()) !== false) {
      if (isdigit(c) || c === '-' || c === '+')
        return num();
      else if (peek(3) === 'Inf' || peek(3) === 'NaN')
        return num();
      else if (isalpha(c))
        return literal();
      else if (c == "'" || c == '"')
        return str();
      else if (c == '{') {
        return obj();
      }
      else if (c == '[') {
        return arr();
      }
      else if (!isspace(c)) {
        log_('value', 'Unexpected symbol' + c);
        error('Unexpected symbol: ' + c, 1);
        get();
        return;
      }
    }    
  }
  
  // Reads an array.
  function arr() {
    var array = [];
    var c, brk = false;
    var expecting = 'value';
    get(); // read '['
    push('Array');
    while ((c = peek()) !== false) {
      whitespace();
      c = peek();
      if (c === false)
        break;
      else if (c == ']') {        
        get();
        stack.pop();
        brk = true;
      } else if (c == ',') {
        if (expecting != 'sep')
          error('Unexpected separator: "' + c + '"', 0);
        get();
        expecting = 'value';
      }
      else {
        var val = value();
        if (typeof(val) !== 'undefined') {
          if (expecting == 'value') {
            log_('arr', 'Found value:' + val);
            array.push(val);
          } else {
            log_('arr', 'Found stray value: ' + val);
            error('Unexpected value "' + val + '"', 1);
          }
          expecting = 'sep';
        }
      }
      if (brk)
        break;
    }
    return array;
  }
  
  // Reads an object literal.
  function obj() {    
    var expecting = 'key', c;
    var object = {};
    var k, v, k_ = false, v_ = false, brk = false;
    push('Object');
    get(); // read the {
    whitespace();    
    while ((c = peek()) !== false) {
      whitespace(); 
      c = peek();
      
      if (c === false) {
        brk = true;
      }
      else if (c == '}') {
        stack.pop();
        if (!(expecting == 'key' || expecting == 'sep')) 
          error('Unexpected close-brace "}", expecting: ' + expecting, 1);
        brk = true;
        get();
      }
      else if (c == ',') {
        if (expecting != 'sep') {
          log_('obj', 'Unexpected separator');
          error('Unexpected separator "' + c + '", expecting: ' + expecting, 1);
        }
        expecting = 'key';
        k_ = false;
        get();
      }
      else if (c == ':') {
        if (expecting != 'keyvalsep') {
          log_('obj', 'Unexpected colon');
          error('Unexpected symbol "' + c + '", expecting: ' + expecting , 1);
        }          
        expecting = 'value';
        v_ = false;
        get();        
      }      
      else if (expecting === 'key') {
        k = key();
        if (typeof k !== 'undefined') {
          k_ = true;
          log_('obj', 'Found key: ' + k);
          expecting = 'keyvalsep';
        }
      }
      else if (expecting === 'value') {
        v = value();
        if (typeof v !== 'undefined') {
          v_ = true;
          log_('obj', 'Found value: ' + v);
          expecting = 'sep';
        }
      }
      else {
        error('Unexpected symbol: "' + c + '"', 1);
        get();
      }
      
      if (k_ && v_) {
        k_ = false; 
        v_ = false;
        object[k] = v;
        log_('obj', 'Inserted pair: ' + k + ' ' + v);        
        expecting = 'sep';
      }
      if (brk)
        break;
    }
    return object;
  }
  
  whitespace();
  var val = value();
  
  if (stack.length) {
    var s = [];
    
    stack.reverse();
    for (var j=0; j<stack.length; j++) {
      var t = stack[j];
      errors.push({desc: 'Unterminated type: ' + t.type.toLowerCase(),
                   lineno: t.lineno,
                   charno: t.charno,
                   level: 1});
    }    
  }
  
  return val;
  
}


/**
 * @param {*} object
 * @param {boolean=} strict
 * @return {string}
 * 
 * FIXME: this will infinite recurse on circular references.
 * 
 * If strict is set to true and any of: undefined, NaN, [+-]?Infinfity occurs 
 *  anywhere in the input, an exception will be thrown;
 */
function writeJson(object, strict) {  
  var i, vals;
  strict = !!strict;
  
  if (typeof object === 'undefined') {
    if (strict) {
      throw 'undefined object was given to JSON encoder';
    }
    return 'undefined';
  }
  else if (object === null)
    return 'null';
  else if (typeof object === 'string') {
    return '"' + object.replace(/[\"\\/\b\f\n\r\t]/g, 
                                function($0) { return '\\' + $0; })  + '"';
  }
  else if (object.constructor.toString().indexOf('Array') !== -1) {
    vals = [];
    for(i=0; i<object.length; i++)
      vals.push(writeJson(object[i]))
    return '[' + vals.join(',') + ']';
  }
  else if (typeof object === 'object') {
    vals = []
    for (var key in object) {
      if (!object.hasOwnProperty(key)) continue;
      vals.push('"' + key + '": ' + writeJson(object[key]));      
    }
    return '{' + vals.join(',') + '}';
  }
  
  else if (typeof object === 'number') {
    if (strict && isNaN(object)) {
      throw 'NaN was given to JSON encoder';
    }
    else if (strict && !isFinite(object)) {
      throw '+/- Infinity was given to JSON encoder';
    }
    return object.toString();
  }  
  else if (object.toString) 
    return object.toString();
  else // meh
    return '' + object;
} 
