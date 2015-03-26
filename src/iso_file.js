var ISOFile = function(arrayBuffer) {
  this._raw = new DataView(arrayBuffer);
  this._cursor = new ISOBoxer.Cursor();
  this.boxes = [];
}

ISOFile.prototype.parse = function() {
  this._cursor.offset = 0;
  this.boxes = [];
  while (this._cursor.offset < this._raw.byteLength) {
    this.boxes.push(ISOBox.parse(this));
  }
  return this;
}