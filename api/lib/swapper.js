'use strict';

const item_A = true,
      item_B = false;

// Like double-buffering... but with databases.
// Consistency and completeness are critical.
function Swapper(a, b){
    this.items = {};
    this.items[item_A] = a;
    this.items[item_B] = b;
    this.selected = item_A;
}

Swapper.prototype.swap = function(){
    this.selected = !this.selected;
    return this.active();
}

Swapper.prototype.active = function(a){
    if (a !== undefined){
        this.items[this.selected] = a;
    }
    return this.items[this.selected];
}

Swapper.prototype.syncing = function(s){
    if (s !== undefined){
        this.items[!this.selected] = s;
    }
    return this.items[!this.selected];
}

Swapper.prototype.identify = function(obj){
    if (obj === this.items[item_A]) return 'A';
    if (obj === this.items[item_B]) return 'B';
    return undefined;
}

module.exports = Swapper;

