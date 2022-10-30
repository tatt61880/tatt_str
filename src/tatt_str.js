'use strict';

// {{{ global variables / constants
window.addEventListener('load', onLoad, false);
const idNoBlock = -1;
const idInitial = -2;
const idTarget = -3;
const idSimple = 0;
const blockWidth = 25;
const blockHeight = 19;
const blockWidth2 = 12;
const blockHeight2 = 13;
const fontname = 'MS Gothic';

let canvas1;
let canvas2;
let ctx1;
let ctx2;
let textareaInput;
let fontsizeInput;
let fontsize = 12;
let fontInfo;
const img = new Image();
img.src = './images/blocks.png?v=20190407';

let ctx2Xnext = 0;
let ctx2Ynext = 0;
let ctx2X = 0;
let ctx1X = 0;
let currentY = 0;
// }}}

// {{{ onLoad
function onLoad() {
  canvas1 = document.getElementById('cv1');
  canvas2 = document.getElementById('cv2');
  ctx1 = canvas1.getContext('2d');
  ctx2 = canvas2.getContext('2d');
  textareaInput = document.getElementById('textarea');
  fontsizeInput = document.getElementById('fontsize');
  fontInfo = document.getElementById('font_info');
  textareaInput.addEventListener('input', onChange, false);
  fontsizeInput.addEventListener('input', onChange, false);
  textareaInput.value = 'Hello!!';
  fontsizeInput.value = 12;

  onChange();
}
// }}}

// {{{ onChange
function onChange() {
  const text = textareaInput.value;
  fontsize = fontsizeInput.value;
  ctx1.clearRect(0, 0, canvas1.width, canvas1.height);

  draw(text); // 描画に必要な幅と高さを計算するために一度描画します。
  canvas2.width = (ctx2Xnext + 1.5) * blockWidth2;
  canvas2.height = ctx2Ynext * blockHeight2;
  draw(text); // 再描画します。
  fontInfo.innerHTML = ctx1.font;
}
// }}}

// {{{ draw
function draw(text) {
  ctx2Xnext = 0;
  ctx2X = 0;
  ctx1X = 0;
  currentY = 0;
  ctx2.fillStyle = 'rgb(255, 255, 255)';
  ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
  for (let i = 0; i < text.length; i++) {
    const data = getCharData(text[i]);
    addTatt(data);
    drawData(data);
  }
}
// }}}

// {{{ getCharData
function getCharData(txt) {
  ctx1.font = fontsize + 'px ' + fontname;
  ctx1.fillStyle = 'blue';

  const tm = ctx1.measureText(txt);
  const width = Math.ceil(tm.width);
  const height = fontsize;
  ctx1.fillText(txt, ctx1X, currentY + fontsize);

  let minX = ctx1X;
  let maxX = ctx1X + width - 1;
  const minY = currentY;
  const maxY = currentY + height;

  /*
  for (let y = maxY; y >= minY; y--) {
    for (let x = maxX; x < minX; x++) {
      let alpha = ctx1.getImageData(x, y, 1, 1).data[3];
      if (alpha) {
        maxY = y;
        x = maxX + 1;
        y = -1;
      }
    }
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      let alpha = ctx1.getImageData(x, y, 1, 1).data[3];
      if (alpha) {
        minY = y;
        x = maxX + 1;
        y = maxY + 1;
      }
    }
  }
  */

  for (let x = maxX; x >= minX; x--) {
    for (let y = minY; y <= maxY; y++) {
      const alpha = ctx1.getImageData(x, y, 1, 1).data[3];
      if (alpha) {
        maxX = x;
        x = -1;
        y = maxY + 1;
      }
    }
  }

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const alpha = ctx1.getImageData(x, y, 1, 1).data[3];
      if (alpha) {
        minX = x;
        x = maxX + 1;
        y = maxY + 1;
      }
    }
  }

  /*
  console.log(minX);
  console.log(maxX);
  console.log(minY);
  console.log(maxY);
  */

  const data = new Array(maxY - minY + 1);
  for (let y = minY; y <= maxY; y++) {
    data[y - minY] = new Array(maxX - minX + 1);
    for (let x = minX; x <= maxX; x++) {
      const alpha = ctx1.getImageData(x, y, 1, 1).data[3];
      if (alpha) {
        data[y - minY][x - minX] = idSimple;
      } else {
        data[y - minY][x - minX] = idNoBlock;
      }
    }
    // console.log(str);
  }

  ctx2X = ctx2Xnext;
  ctx2Xnext += maxX - minX + 2;
  ctx2Ynext = currentY + maxY - minY + 2;
  ctx1X += width;
  return data;
}
// }}}

// {{{ addTatt
function addTatt(data) {
  const height = data.length;
  const width = data[0].length;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y][x] == idSimple) {
        data[y][x] = idInitial;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y][x] == idInitial) {
        setTarget(x, y, data);
        redistributeId(data);
      }
    }
  }
}

function setTarget(x, y, data) {
  const height = data.length;
  const width = data[0].length;
  const st = new Stack();
  st.push([x, y]);
  while (st.size()) {
    const pos = st.pop();
    const xx = pos[0];
    const yy = pos[1];
    data[yy][xx] = idTarget;
    const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
    const dy = [-1, 0, 1, -1, 1, -1, 0, 1];
    for (let i = 0; i < 8; i++) {
      const xxx = xx + dx[i];
      const yyy = yy + dy[i];
      if (0 <= xxx && xxx < width && 0 <= yyy && yyy < height) {
        if (data[yyy][xxx] == idInitial) {
          st.push([xxx, yyy]);
        }
      }
    }
  }
}

function redistributeId(data) {
  const height = data.length;
  const width = data[0].length;

  let minY;
  let maxY;
  let minX;
  let maxX;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (data[y][x] == idTarget) {
        maxY = y;
        y = -1;
        break;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y][x] == idTarget) {
        minY = y;
        y = height;
        break;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (data[y][x] == idTarget) {
        minX = x;
        x = width;
        break;
      }
    }
  }
  for (let x = width - 1; x >= 0; x--) {
    for (let y = minY; y <= maxY; y++) {
      if (data[y][x] == idTarget) {
        maxX = x;
        x = -1;
        break;
      }
    }
  }

  // 脚の部分(先に脚から解析することで、頭が脚に挟まれた状態のブロックも良い感じ)
  let legL;
  let legR;
  if (minY != maxY || maxX - minX >= 2) {
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] == idTarget) {
          legL = x;
          for (let xx = width - 1; xx >= 0; xx--) {
            if (data[y][xx] == idTarget) {
              legR = xx;
              break;
            }
          }
          if (legL == legR) {
            data[y][legL] = 5;
          } else {
            data[y][legL] = 6;
            data[y][legR] = 7;
          }
          y = -1;
          break;
        }
      }
    }

    // 顔の部分
    let faceL;
    let faceR;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] == idTarget) {
          faceL = x;
          for (let xx = width - 1; xx >= 0; xx--) {
            if (data[y][xx] == idTarget) {
              faceR = xx;
              break;
            }
          }

          if (faceL == faceR) {
            data[y][faceL] = 1;
          } else if (faceL == faceR - 1) {
            data[y][faceL] = 8;
            data[y][faceL + 1] = 9;
          } else if (faceL == faceR - 2) {
            if (data[y][faceL + 1] == idTarget) {
              data[y][faceL] = 2;
              data[y][faceL + 1] = 3;
              data[y][faceL + 2] = 4;
            } else {
              data[y][faceL] = 1;
            }
          } else {
            data[y][faceL] = 1;
          }
          y = height;
          break;
        }
      }
    }
  }

  // それ以外
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y][x] == idTarget) {
        data[y][x] = idSimple;
      }
    }
  }
}
// }}}

// {{{ drawData
function drawData(data) {
  const height = data.length;
  const width = data[0].length;
  const drawLine = document.getElementById('checkboxDrawLine').checked;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const posX = (ctx2X + x + 1) * blockWidth2;
      const posY = (currentY + y) * blockHeight2 - x;
      if (data[y][x] != idNoBlock) {
        drawBlock(posX, posY, data[y][x], 0);
        if (drawLine) continue;
        let flagRight = false;
        let flagBottom = false;
        if (x != width - 1) {
          if (data[y][x + 1] != idNoBlock) {
            flagRight = true;
            if (data[y][x] != 8) {
              drawBlock(posX, posY, 0, 1);
            }
          }
        }
        if (y != height - 1) {
          if (data[y + 1][x] != idNoBlock) {
            flagBottom = true;
            drawBlock(posX, posY, 1, 1);
          }
          if (x != 0 && !flagBottom) {
            if (data[y + 1][x - 1] != idNoBlock) {
              drawBlock(posX, posY, 2, 1);
            }
          }
        }
        if (flagRight && flagBottom) {
          if (data[y + 1][x + 1] != idNoBlock) {
            drawBlock(posX, posY, 3, 1);
          }
        }
      }
    }
  }
}
// }}}

// {{{ drawBlock
function drawBlock(x, y, id, h) {
  ctx2.drawImage(
    img,
    id * blockWidth,
    h * blockHeight,
    blockWidth,
    blockHeight,
    x,
    y,
    blockWidth,
    blockHeight
  );
}
// }}}

// {{{ Stack
class Stack {
  constructor() {
    this.data = [];
  }
  push(val) {
    this.data.push(val);
    return val;
  }
  pop() {
    return this.data.pop();
  }
  top() {
    return this.data[this.data.length - 1];
  }
  size() {
    return this.data.length;
  }
  empty() {
    return this.data.length == 0;
  }
}
// }}}

// vim:set expandtab ts=2 sw=2 sts=2:
