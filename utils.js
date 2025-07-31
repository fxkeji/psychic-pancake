// utils.js
// 自动校正：核心算法全部转为调用imposition_core，保证前后端一致
const core = require('./imposition_core');

// 从文件名中提取份数（如“20份”或“20份-”等，返回数字）
function extractQuantity(fileName) {
  const match = fileName.match(/(\d+)份/);
  if (match) {
    return parseInt(match[1], 10);
  }
  const config = require('./config');
  console.warn(`⚠️ 文件名未含份数，使用默认值：${config.DEFAULT_QUANTITY}`);
  return config.DEFAULT_QUANTITY;
}

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
// 获取PDF尺寸（单位mm，优先CropBox，无则MediaBox）
async function getPdfDimensions(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(data);
    const page = pdfDoc.getPage(0);
    let box = page.getCropBox ? page.getCropBox() : null;
    if (!box || !box.width || !box.height) {
      box = page.getMediaBox();
    }
    if (!box || !box.width || !box.height) {
      throw new Error('无法获取PDF页面尺寸');
    }
    const mmPerPt = 25.4 / 72;
    return {
      width: Math.round(box.width * mmPerPt),
      height: Math.round(box.height * mmPerPt)
    };
  } catch (e) {
    console.error('获取PDF尺寸失败:', e);
    return {
      error: `解析失败: ${e.message}`,
      status: 'INVALID_PDF'
    };
  }
}

function getLayoutModeKey(layoutWidth, layoutHeight) {
  if (layoutWidth === 750 && layoutHeight === 530) return "750x530";
  if (layoutWidth === 464 && layoutHeight === 320) return "464x320";
  return "custom";
}

// 保留原有adjustSorting逻辑（如有特殊业务可自定义）
function adjustSorting(scheme, isSingle, imposeType) {
  // 如果scheme已经有正确的排序字符串，直接使用
  if (scheme.sortString && scheme.sortString.includes('<') || scheme.sortString.includes('>')) {
    return scheme;
  }
  
  let sortString = '';
  if (imposeType === 'CutStacks') {
    sortString = Array.from({length: scheme.totalCount}, (_, i) => `${i+1}`).join(' ');
  } else if (imposeType === 'CutStacksDouble') {
    sortString = Array.from({length: scheme.totalCount}, (_, i) => i % 2 === 0 ? `${i+1}<` : `${i+1}>`).join(' ');
  } else {
    if (isSingle) {
      // 单面拼版：使用原有的排序字符串
      sortString = scheme.sortString || Array.from({length: scheme.totalCount}, (_, i) => `${i+1}`).join(' ');
    } else {
      // 双面拼版：使用已定方案库中的正确排序字符串
      sortString = scheme.sortString || Array.from({length: scheme.totalCount}, (_, i) => i % 2 === 0 ? `${i+1}<` : `${i+1}>`).join(' ');
    }
  }
  return { ...scheme, sortString };
}

module.exports = {
  layoutModeParams: core.layoutModeParams,
  calculateGapWithMarginPriority: core.calculateGapWithMarginPriority,
  generateMixedSchemes: core.generateMixedSchemes,
  calculateLayout: core.calculateLayout,
  generateSortString: core.generateSortString,
  extractQuantity,
  getPdfDimensions,
  getLayoutModeKey,
  adjustSorting
};