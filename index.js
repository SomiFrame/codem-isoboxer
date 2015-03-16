(function(exports) {
  var Cursor = function(initialOffset) {
    this.offset = (typeof initialOffset == 'undefined' ? 0 : initialOffset);
  }
  
  var ISOBox = function() {
    this._cursor = new Cursor();
    this._cursor.name = 'ISOBox';
  }
  ISOBox.parse = function(raw, cursor) {
    var newBox = new ISOBox();
    newBox._offset = cursor.offset;
    newBox._raw = raw;
    newBox._parseBox()
    cursor.offset = newBox._raw.byteOffset + newBox._raw.byteLength;
    return newBox;
  }
  ISOBox.prototype._readUint = function(size) {
    //console.log(this.cursor.name + ": " + this.cursor.offset);
    var result = null;
    switch(size) {
    case 8:
      result = this._raw.getUint8(this._cursor.offset - this._raw.byteOffset);
      break;
    case 16:
      result = this._raw.getUint16(this._cursor.offset - this._raw.byteOffset);
      break;
    case 24:
      var s1 = this._raw.getUint16(this._cursor.offset - this._raw.byteOffset);
      var s2 = this._raw.getUint8(this._cursor.offset - this._raw.byteOffset + 2);
      result = (s1 << 4) + s2;
      break;
    case 32:
      result = this._raw.getUint32(this._cursor.offset - this._raw.byteOffset);
      break;
    case 64:
      var s1 = this._raw.getUint32(this._cursor.offset - this._raw.byteOffset);
      var s2 = this._raw.getUint32(this._cursor.offset - this._raw.byteOffset + 4);
      result = (s1 << 8) + s2;
      break;
    }
    this._cursor.offset += (size >> 3);
    return result;        
  }
  ISOBox.prototype._readString = function(length) {
    var str = '';
    for (var c = 0; c < length; c++) {
      var char = this._readUint(8);
      str += String.fromCharCode(char);
    }
    return str;    
  }
  ISOBox.prototype._readTemplate = function(size) {
    var pre = this._readUint(size / 2);
    var post = this._readUint(size / 2);
    return pre + (post / Math.pow(2, size / 2));
  }
  ISOBox.prototype._parseBox = function() {
    this._cursor.offset = this._offset;
    this.size = this._readUint(32);
    this.type = this._readString(4);
    //console.log("type: " + this.type)
    if (this.size == 1)      { this.largesize = this._readUint(64); }
    if (this.type == 'uuid') { this.usertype = this._readString(16); }

    switch(this.size) {
    case 0:
      this._raw = new DataView(this._raw.buffer, this._offset, (this._raw.byteLength - this._cursor.offset));
      break;
    case 1:
      this._raw = new DataView(this._raw.buffer, this._offset, this.largesize);
      break;
    default:
      this._raw = new DataView(this._raw.buffer, this._offset, this.size);
    }

    // additional parsing
    if (this._boxParsers[this.type]) this._boxParsers[this.type].call(this);    
  }
  ISOBox.prototype._parseFullBox = function() {
    this.version = this._readUint(8);
    this.flags = this._readUint(24);
  }
  ISOBox.prototype._boxParsers = {};
  ISOBox.prototype._boxParsers['free'] = ISOBox.prototype._boxParsers['skip'] = function() {
    this._cursor.name += " free/skip";
    this.data = [];
    while (this._cursor.offset - this._raw.byteOffset < this._raw.byteLength) {
      this.data.push(this._readUint(8));
    }
  }
  ISOBox.prototype._boxParsers['ftyp'] = function() {
    this._cursor.name += " ftyp";
    this.major_brand = this._readString(4);
    this.minor_versions = this._readUint(32);
    this.compatible_brands = [];
    
    while (this._cursor.offset - this._raw.byteOffset < this._raw.byteLength) {
      this.compatible_brands.push(this._readString(4));
    }
  }
  ISOBox.prototype._boxParsers['moov'] = function() {
    this._cursor.name += " moov";
    this.boxes = [];
    while (this._cursor.offset < this._raw.byteLength) {
      this.boxes.push(ISOBox.parse(this._raw, this._cursor));
    }
  }
  ISOBox.prototype._boxParsers['mvhd'] = function() {
    this._cursor.name += " mvhd";
    this._parseFullBox();
    
    if (this.version == 1) {
      this.creation_time     = this._readUint(64);
      this.modification_time = this._readUint(64);
      this.timescale         = this._readUint(32);
      this.duration          = this._readUint(64);
    } else {
      this.creation_time     = this._readUint(32);
      this.modification_time = this._readUint(32);
      this.timescale         = this._readUint(32);
      this.duration          = this._readUint(32);      
    }
    
    this.rate      = this._readTemplate(32);
    this.volume    = this._readTemplate(16);
    this.reserved1 = this._readUint(16);
    this.reserved2 = [
      this._readUint(32),
      this._readUint(32)
    ];
    this.matrix = [];
    for (var i=0; i<9; i++) {
      this.matrix.push(this._readTemplate(32));
    }
    this.pre_defined = [];
    for (var i=0; i<6; i++) {
      this.pre_defined.push(this._readUint(32));
    }
    this.next_track_ID = this._readUint(32);
  }
  ISOBox.prototype._boxParsers['tkhd'] = function() {
    this._cursor.name += " tkhd";
    this._parseFullBox();
    
    if (this.version == 1) {
      this.creation_time     = this._readUint(64);
      this.modification_time = this._readUint(64);
      this.track_ID          = this._readUint(32);
      this.reserved1         = this._readUint(32);
      this.duration          = this._readUint(64);
    } else {
      this.creation_time     = this._readUint(32);
      this.modification_time = this._readUint(32);
      this.track_ID          = this._readUint(32);
      this.reserved1         = this._readUint(32);
      this.duration          = this._readUint(32);
    }
    
    this.reserved2 = [
      this._readUint(32),
      this._readUint(32)
    ];
    this.layer = this._readUint(16);
    this.alternate_group = this._readUint(16);
    this.volume = this._readTemplate(16);
    this.reserved3 = this._readUint(16);
    this.matrix = [];
    for (var i=0; i<9; i++) {
      this.matrix.push(this._readTemplate(32));
    }
    this.width = this._readUint(32);
    this.height = this._readUint(32);
  }
  ISOBox.prototype._boxParsers['trak'] = function() {
    this._cursor.name += " trak";
    this.boxes = [];
    while (this._cursor.offset < this._raw.byteLength) {
      this.boxes.push(ISOBox.parse(this._raw, this._cursor));
    }
  }

  var ISOFile = function(arrayBuffer) {
    this._raw = new DataView(arrayBuffer);
    this._cursor = new Cursor();
    this._cursor.name = 'ISOFile';
    this.boxes = [];
  }
  ISOFile.prototype.parse = function() {
    this._cursor.offset = 0;
    this.boxes = [];
    while (this._cursor.offset < this._raw.byteLength) {
      this.boxes.push(ISOBox.parse(this._raw, this._cursor));
    }
    return this;
  }
  
  exports.create = function(arrayBuffer) {
    return new ISOFile(arrayBuffer).parse();
  };
})(typeof exports === 'undefined'? this['ISOBoxer']={}: exports);