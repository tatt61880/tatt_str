(function () {
  'use strict';

  const VERSION_TEXT = 'v2026.11.01';

  const ID_NO_BLOCK = -1;
  const ID_INITIAL = -2;
  const ID_TARGET = -3;
  const ID_SIMPLE = 0;
  const BLOCK_WIDTH = 25;
  const BLOCK_HEIGHT = 19;
  const BLOCK_WIDTH_OUTPUT = 12;
  const BLOCK_HEIGHT_OUTPUT = 13;
  const FONT_NAME = '"MS Gothic", "Osaka-Mono", monospace';
  const DEFAULT_FONT_SIZE = 12;
  const MIN_FONT_SIZE = 2;
  const MAX_FONT_SIZE = 20;

  let canvasPreview;
  let canvasOutput;
  let contextPreview;
  let contextOutput;
  let textInput;
  let fontSizeInput;
  let drawLineInput;
  let blockImage;
  let outputX = 0;
  let outputY = 0;
  let outputTop = 0;
  let outputBottom = 0;

  const rasterCanvas = document.createElement('canvas');
  const rasterContext = rasterCanvas.getContext('2d', { willReadFrequently: true });

  document.addEventListener('DOMContentLoaded', initialize);

  async function initialize() {
    canvasPreview = document.getElementById('cv1');
    canvasOutput = document.getElementById('cv2');
    contextPreview = canvasPreview.getContext('2d');
    contextOutput = canvasOutput.getContext('2d');
    textInput = document.getElementById('text-input');
    fontSizeInput = document.getElementById('font-size-input');
    drawLineInput = document.getElementById('checkbox-draw-line');

    document.getElementById('version').textContent = VERSION_TEXT;
    textInput.value = 'Hello!!';
    fontSizeInput.value = DEFAULT_FONT_SIZE;

    try {
      blockImage = await loadImage('./images/blocks.png?v=2023.11.11');
    } catch {
      document.getElementById('status').textContent = 'ブロック画像を読み込めませんでした。ページを再読み込みしてください。';
      return;
    }

    document.getElementById('save-image').addEventListener('click', () => {
      canvasOutput.toBlob((blob) => {
        if (!blob) {
          document.getElementById('status').textContent = '画像を保存できませんでした。';
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'tatt-str.png';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }, 'image/png');
    });

    textInput.addEventListener('input', render);
    fontSizeInput.addEventListener('input', render);
    drawLineInput.addEventListener('change', render);

    render();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function render() {
    const text = textInput.value.slice(0, 500).replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const fontSize = getFontSize();

    drawPreview(lines, fontSize);

    const glyphLines = lines.map((line) => splitGraphemes(line).map((character) => getCharData(character, fontSize)));
    outputTop = Infinity;
    outputBottom = 1;
    let maxWidth = 0;
    for (const glyphs of glyphLines) {
      let width = 0;
      for (const data of glyphs) {
        for (let y = 0; y < data.length; y++) {
          for (let x = 0; x < data[y].length; x++) {
            if (data[y][x] === ID_NO_BLOCK) continue;
            outputTop = Math.min(outputTop, y * BLOCK_HEIGHT_OUTPUT - x);
            outputBottom = Math.max(outputBottom, y * BLOCK_HEIGHT_OUTPUT - x + BLOCK_HEIGHT);
          }
        }
        width += data[0].length + 1;
      }
      maxWidth = Math.max(maxWidth, width);
    }
    if (!Number.isFinite(outputTop)) {
      outputTop = 0;
      outputBottom = fontSize * BLOCK_HEIGHT_OUTPUT;
    }
    // 全行で同じ基準位置・高さを使い、先頭・途中・末尾の空行も残します。
    const lineHeight = outputBottom - outputTop;
    const lineGap = 2 * BLOCK_HEIGHT_OUTPUT;
    const outputWidth = Math.ceil((maxWidth + 1.5) * BLOCK_WIDTH_OUTPUT);
    const outputHeight = glyphLines.length * lineHeight + (glyphLines.length - 1) * lineGap;
    const status = document.getElementById('status');
    const save = document.getElementById('save-image');
    if (outputWidth > 16000 || outputHeight > 16000 || outputWidth * outputHeight > 16000000) {
      canvasOutput.width = canvasOutput.height = 1;
      status.textContent = '画像が大きすぎます。文字数や行数を減らしてください。';
      save.disabled = true;
      return;
    }
    canvasOutput.width = text.length ? outputWidth : 1;
    canvasOutput.height = text.length ? outputHeight : 1;
    contextOutput.fillStyle = '#ffffff';
    contextOutput.fillRect(0, 0, canvasOutput.width, canvasOutput.height);
    outputY = 0;
    for (const glyphs of glyphLines) {
      outputX = 0;
      for (const data of glyphs) {
        addTatt(data);
        drawData(data);
        outputX += data[0].length + 1;
      }
      outputY += lineHeight + lineGap;
    }
    status.textContent = '';
    save.disabled = text.length === 0;
  }

  function getFontSize() {
    if (fontSizeInput.value === '') return DEFAULT_FONT_SIZE;
    const value = Math.round(Number(fontSizeInput.value));
    if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
    return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
  }

  function drawPreview(lines, fontSize) {
    const font = `${fontSize}px ${FONT_NAME}`;
    contextPreview.font = font;

    const measuredWidth = Math.ceil(Math.max(...lines.map((line) => contextPreview.measureText(line).width)));
    canvasPreview.width = Math.max(1, measuredWidth + 4);
    const lineHeight = fontSize + 6;
    canvasPreview.height = lines.length * lineHeight;

    contextPreview.font = font;
    contextPreview.fillStyle = 'blue';
    contextPreview.textBaseline = 'top';
    lines.forEach((line, index) => contextPreview.fillText(line, 2, 2 + index * lineHeight));
  }

  function splitGraphemes(text) {
    if (typeof Intl.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text), ({ segment }) => segment);
    }
    return Array.from(text);
  }

  function getCharData(character, fontSize) {
    const font = `${fontSize}px ${FONT_NAME}`;
    rasterContext.font = font;
    const metrics = rasterContext.measureText(character);
    const leftPadding = Math.ceil(Math.max(0, metrics.actualBoundingBoxLeft));
    const measuredWidth = Math.max(1, Math.ceil(Math.max(metrics.width, metrics.actualBoundingBoxRight)) + leftPadding);
    const baseline = Math.ceil(fontSize * 1.5);
    const dataHeight = Math.max(fontSize * 2, baseline + Math.ceil(metrics.actualBoundingBoxDescent) + 1);

    rasterCanvas.width = measuredWidth;
    rasterCanvas.height = dataHeight;
    rasterContext.font = font;
    rasterContext.fillStyle = '#000000';
    rasterContext.textBaseline = 'alphabetic';
    rasterContext.fillText(character, leftPadding, baseline);

    const imageData = rasterContext.getImageData(0, 0, rasterCanvas.width, rasterCanvas.height);
    const horizontalBounds = findHorizontalBounds(imageData);

    if (horizontalBounds === null) {
      return createEmptyData(dataHeight, measuredWidth);
    }

    const { minX, maxX } = horizontalBounds;
    const dataWidth = maxX - minX + 1;
    const data = Array.from({ length: dataHeight }, () => Array(dataWidth).fill(ID_NO_BLOCK));

    for (let y = 0; y < dataHeight; y++) {
      for (let x = minX; x <= maxX; x++) {
        // アンチエイリアスで薄く描かれた横線なども、元の処理と同様に残します。
        if (getAlpha(imageData, x, y) !== 0) {
          data[y][x - minX] = ID_SIMPLE;
        }
      }
    }

    return data;
  }

  function findHorizontalBounds(imageData) {
    let minX = imageData.width;
    let maxX = -1;

    for (let x = 0; x < imageData.width; x++) {
      for (let y = 0; y < imageData.height; y++) {
        if (getAlpha(imageData, x, y) === 0) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        break;
      }
    }

    if (maxX < 0) return null;
    return { minX, maxX };
  }

  function getAlpha(imageData, x, y) {
    return imageData.data[(y * imageData.width + x) * 4 + 3];
  }

  function createEmptyData(height, width) {
    return Array.from({ length: height }, () => Array(width).fill(ID_NO_BLOCK));
  }

  function addTatt(data) {
    const height = data.length;
    const width = data[0].length;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] === ID_SIMPLE) data[y][x] = ID_INITIAL;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] === ID_INITIAL) {
          setTarget(x, y, data);
          redistributeId(data);
        }
      }
    }
  }

  function setTarget(x, y, data) {
    const height = data.length;
    const width = data[0].length;
    const stack = [[x, y]];
    const directions = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1],
    ];

    while (stack.length > 0) {
      const [currentX, currentY] = stack.pop();
      if (data[currentY][currentX] !== ID_INITIAL) continue;
      data[currentY][currentX] = ID_TARGET;

      for (const [dx, dy] of directions) {
        const nextX = currentX + dx;
        const nextY = currentY + dy;
        if (0 <= nextX && nextX < width && 0 <= nextY && nextY < height && data[nextY][nextX] === ID_INITIAL) {
          stack.push([nextX, nextY]);
        }
      }
    }
  }

  function redistributeId(data) {
    const height = data.length;
    const width = data[0].length;
    const bounds = getTargetBounds(data);
    if (bounds === null) return;

    const { minX, minY, maxX, maxY } = bounds;

    if (minY !== maxY || maxX - minX >= 2) {
      setLegBlocks(data, bounds);
      setFaceBlocks(data, bounds);
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[y][x] === ID_TARGET) data[y][x] = ID_SIMPLE;
      }
    }
  }

  function getTargetBounds(data) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < data.length; y++) {
      for (let x = 0; x < data[y].length; x++) {
        if (data[y][x] !== ID_TARGET) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX < 0) return null;
    return { minX, minY, maxX, maxY };
  }

  function setLegBlocks(data, bounds) {
    for (let y = bounds.maxY; y >= bounds.minY; y--) {
      const targets = getTargetXs(data[y]);
      if (targets.length === 0) continue;

      const left = targets[0];
      const right = targets.at(-1);
      if (left === right) {
        data[y][left] = 5;
      } else {
        data[y][left] = 6;
        data[y][right] = 7;
      }
      return;
    }
  }

  function setFaceBlocks(data, bounds) {
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      const targets = getTargetXs(data[y]);
      if (targets.length === 0) continue;

      const left = targets[0];
      const right = targets.at(-1);
      if (left === right) {
        data[y][left] = 1;
      } else if (right - left === 1) {
        data[y][left] = 8;
        data[y][right] = 9;
      } else if (right - left === 2 && data[y][left + 1] === ID_TARGET) {
        data[y][left] = 2;
        data[y][left + 1] = 3;
        data[y][right] = 4;
      } else {
        data[y][left] = 1;
      }
      return;
    }
  }

  function getTargetXs(row) {
    const result = [];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ID_TARGET) result.push(x);
    }
    return result;
  }

  function drawData(data) {
    const height = data.length;
    const width = data[0].length;
    const drawLine = drawLineInput.checked;

    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        if (data[y][x] === ID_NO_BLOCK) continue;

        const posX = (outputX + x + 1) * BLOCK_WIDTH_OUTPUT;
        const posY = outputY + y * BLOCK_HEIGHT_OUTPUT - x - outputTop;
        drawBlock(posX, posY, data[y][x], 0);

        if (drawLine) continue;

        const hasRight = x !== width - 1 && data[y][x + 1] !== ID_NO_BLOCK;
        const hasBottom = y !== height - 1 && data[y + 1][x] !== ID_NO_BLOCK;

        if (hasRight && data[y][x] !== 8) drawBlock(posX, posY, 0, 1);
        if (hasBottom) drawBlock(posX, posY, 1, 1);

        if (y !== height - 1 && x !== 0 && !hasBottom && data[y + 1][x - 1] !== ID_NO_BLOCK) {
          drawBlock(posX, posY, 2, 1);
        }

        if (hasRight && hasBottom && data[y + 1][x + 1] !== ID_NO_BLOCK) {
          drawBlock(posX, posY, 3, 1);
        }
      }
    }
  }

  function drawBlock(x, y, id, row) {
    contextOutput.drawImage(
      blockImage,
      id * BLOCK_WIDTH,
      row * BLOCK_HEIGHT,
      BLOCK_WIDTH,
      BLOCK_HEIGHT,
      x,
      y,
      BLOCK_WIDTH,
      BLOCK_HEIGHT
    );
  }
})();
