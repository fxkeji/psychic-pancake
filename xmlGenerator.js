// xmlGenerator.js
const fs = require('fs');
const config = require('./config');
const utils = require('./utils');

function mm2pt(mm) {
  return parseFloat((mm * 2.83465).toFixed(4));
}

// 从文件名前缀中提取基础帖P数
function getBasePFromFileName(fileName) {
  // 从文件名前缀中提取第3、4位作为基础帖P数
  // 例如：W216C-148x210-5版.pdf -> 16P
  const match = fileName.match(/^[A-Z]{2}(\d{2})/);
  if (match) {
    const baseP = parseInt(match[1], 10);
    console.log(`📋 从文件名前缀提取基础帖P数: ${baseP}P`);
    return baseP;
  }
  
  // 尝试其他模式：W216C -> 16P
  const match2 = fileName.match(/W2(\d{2})/);
  if (match2) {
    const baseP = parseInt(match2[1], 10);
    console.log(`📋 从文件名前缀提取基础帖P数: ${baseP}P`);
    return baseP;
  }
  
  // 如果无法从文件名提取，使用默认值
  console.warn('⚠️ 无法从文件名前缀提取基础帖P数，使用默认值16P');
  return 16;
}

// 锁线装订分帖算法（保留原有逻辑作为备用）
function getBaseP(weight) {
  const minSheets = Math.ceil(600 / weight);
  const maxSheets = Math.floor(700 / weight);
  const idealSheets = Math.round(650 / weight);
  let sheets = Math.max(minSheets, Math.min(maxSheets, idealSheets));
  sheets = Math.max(1, sheets);
  return sheets * 4;
}
function getRanges(p) {
  const dMin = 4;
  const dMax = p;
  const zMin = 4;
  const zMax = p + 8;
  return { dMin, dMax, zMin, zMax };
}
function findParams(P, p) {
  const { dMin, dMax, zMin, zMax } = getRanges(p);
  let bestN, bestD, bestZ, minDiff = Infinity;
  for (let n = 2; n <= Math.ceil(P / 4); n++) {
    const remaining = P - (n - 2) * p;
    if (remaining < dMin + zMin) continue;
    for (let d = Math.min(dMax, remaining); d >= dMin; d -= 4) {
      const z = remaining - d;
      if (z % 4 !== 0 || z < zMin || z > zMax || z < d) continue;
      const diff = Math.abs(d - p) + Math.abs(z - p);
      if (diff < minDiff) {
        minDiff = diff;
        bestN = n;
        bestD = d;
        bestZ = z;
      }
    }
  }
  if (typeof bestN === 'undefined') {
    return null;
  }
  return { n: bestN, p, d: bestD, z: bestZ };
}
function genSheet(start, size) {
  const pages = [];
  const end = start + size - 1;
  const half = size / 2;
  for (let i = 0; i < half; i += 2) {
    pages.push(end - i);
    pages.push(start + i);
    if (i + 1 < half) {
      pages.push(start + i + 1);
      pages.push(end - i - 1);
    }
  }
  return pages;
}
function generateLockingString(scheme) {
  const { n, p, d, z } = scheme.params;
  let current = 1;
  let allPages = [];
  for (let i = 0; i < n - 2; i++) {
    allPages.push(...genSheet(current, p));
    current += p;
  }
  allPages.push(...genSheet(current, d));
  current += d;
  allPages.push(...genSheet(current, z));
  return allPages.join(' ');
}

function generateXML(scheme, type, copies, fileName, xmlPath) {
  if (!scheme || !type) {
    console.error('❌ 生成XML失败: 缺少必要参数');
    return null;
  }
  // 锁线装订处理
  if (type.name && type.name.includes('锁线')) {
    const P = copies;
    if (P % 4 !== 0) {
      console.error(`❌ 锁线装订要求总页数为4的倍数，当前页数${P}`);
      return null;
    }
    
    // 从文件名前缀中提取基础帖P数，不再依赖纸张克重信息
    const p = getBasePFromFileName(fileName);
    const params = findParams(P, p);
    if (!params) {
      console.error('❌ 锁线装订分帖算法未找到合适的分帖方案');
      return null;
    }
    scheme.params = params;
    scheme.sortString = generateLockingString(scheme);
    console.log(`🔗 锁线装订分帖方案: ${params.n}帖, 基础帖${params.p}P, 大帖${params.d}P, 小帖${params.z}P`);
  }
  // 拼版参数补全
  const isDouble = !type.isSingle;
  const imposition_core = require('./imposition_core');
  // 排序字符串用拼版算法真实输出
  const orderString = imposition_core.generateSortString(scheme, type.isSingle ? 'single' : 'double');
  // 行列、间距、边距
  let cols, rows, colGap, rowGap, marginLR, marginTB, layoutW, layoutH, layoutDesc, hSpace, vSpace;
  if (scheme.isMixed) {
    cols = `不旋转${scheme.maxCols1}，旋转${scheme.maxCols2}`;
    rows = `不旋转${scheme.rows1}，旋转${scheme.rows2}`;
    colGap = `不旋转${scheme.colGap1}，旋转${scheme.colGap2}`;
    rowGap = scheme.rowGap;
    marginLR = scheme.finalLeftRightMargin;
    marginTB = scheme.finalTopBottomMargin;
    layoutW = scheme.layoutW || 750;
    layoutH = scheme.layoutH || 530;
    layoutDesc = `不旋转${scheme.maxCols1}×${scheme.rows1}，旋转${scheme.maxCols2}×${scheme.rows2}`;
    hSpace = Math.max(scheme.colGap1 || 0, scheme.colGap2 || 0);
    vSpace = scheme.rowGap;
  } else {
    cols = scheme.cols;
    rows = scheme.rows;
    colGap = scheme.colGap;
    rowGap = scheme.rowGap;
    marginLR = scheme.finalLeftRightMargin;
    marginTB = scheme.finalTopBottomMargin;
    layoutW = scheme.layoutW || 750;
    layoutH = scheme.layoutH || 530;
    layoutDesc = `${scheme.cols}×${scheme.rows}`;
    hSpace = scheme.colGap;
    vSpace = scheme.rowGap;
  }
  
  // 处理旋转版面
  if (scheme.rotated) {
    // 直接使用方案中的尺寸，不再交换
    console.log(`🔄 XML使用旋转版面: ${layoutW}×${layoutH}mm`);
  }
  // 全局声明并赋值边距变量，保证模板引用不会出错
  const CORNER_LINE_LENGTH = 10;
  const marginLR_adj = Math.max(0, marginLR - CORNER_LINE_LENGTH);
  const marginTB_adj = Math.max(0, marginTB - CORNER_LINE_LENGTH);
  const pageOrientation = layoutW >= layoutH ? 'Wide' : 'Tall';
  const sheetAlign = 'C';
  const doubleSideMode = isDouble ? 'Horizontal' : 'None';
  // Shuffle Type判断
  let shuffleType = '';
  if (type.imposeType === 'Normal' || (type.name && (type.name.includes('无线胶订') || type.name.includes('标准') || type.name.includes('骑马钉')))) {
    shuffleType = 'Normal';
  } else if (type.isSingle) {
    shuffleType = 'CutStacksSingle';
  } else {
    shuffleType = 'CutStacksDouble';
  }
  // SheetAlignIndependent参数始终为0
  const sheetAlignIndependent = 0;
  // GroupSize修正：单双面严格区分
  const groupSize = type.isSingle ? scheme.totalCount : scheme.totalCount * 2;

  // 添加富余空间分配日志
  console.log(`📐 间距/边距分配: 列间距=${colGap}mm, 行间距=${rowGap}mm, ` +
              `左右边距=${marginLR}mm, 上下边距=${marginTB}mm`);
  console.log(`📊 Group size: ${groupSize} (${type.isSingle ? '单面' : '双面'})`);

  // Nup命令部分严格用真实参数
  const xmlContent = `<?xml version="1.0" encoding="UTF-8" ?>
<QUITEXML xmlns="http://www.quite.com/general/ns/quitexml/">
<ITEMS>
<DICT N='0'>  <ITEMS>
  <A N='Category'>HistoryItem_V1</A>
  <A N='Command'>PageTools</A>
  <DICT N='Desc'>    <ITEMS>
    <S N='0'>动作：重复页面</S>
    <S N='1'>范围：所有页面</S>
    <S N='2'>副本： ${copies}</S>
    <S N='3'>整理： 是</S>
    </ITEMS>  </DICT>
  <DICT N='Params'>    <ITEMS>
    <A N='Action'>DuplicatePages</A>
    <B N='Collate'>1</B>
    <I N='Copies'>${copies}</I>
    <B N='CropToOriginalCropBox'>0</B>
    <B N='Interactive'>0</B>
    <B N='KeepPageSize'>0</B>
    <I N='MoveAfterPage'>0</I>
    <A N='MoveWhere'>AtEnd</A>
    <A N='Orientation'>${pageOrientation}</A>
    <S N='Requires'>qi3alphabase[QI 3.0/QHI 3.0 alpha]</S>
    <A N='Rotate'>R0</A>
    <F N='RotateDegrees'>0.0000</F>
    <DICT N='Source'>      <ITEMS>
      <DICT N='Range'>        <ITEMS>
        <A N='EvenOdd'>Both</A>
        <I N='From'>1</I>
        <A N='RangeType'>AllDoc</A>
        <I N='To'>${copies}</I>
        </ITEMS>      </DICT>
      <A N='SourceType'>PDDoc</A>
      </ITEMS>    </DICT>
    </ITEMS>  </DICT>
  <I N='Version'>1</I>
  </ITEMS></DICT>
<DICT N='1'>  <ITEMS>
  <A N='Category'>HistoryItem_V1</A>
  <A N='Command'>Shuffle</A>
  <DICT N='Desc'>    <ITEMS>
    <S N='0'>Group size: ${groupSize}</S>
    <S N='1'>Shuffle type: ${shuffleType}</S>
    <S N='2'>Rule: ${orderString}</S>
    <S N='3'>布局：${layoutDesc}</S>
    </ITEMS>  </DICT>
  <DICT N='Params'>    <ITEMS>
    <I N='GroupSize'>${groupSize}</I>
    <S N='Order'>${orderString.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</S>
    <A N='Type'>${shuffleType}</A>
    <B N='Interactive'>0</B>
    <B N='NewDoc'>0</B>
    </ITEMS>  </DICT>
  <I N='Version'>1</I>
  </ITEMS></DICT>
<DICT N='2'>  <ITEMS>
  <A N='Category'>HistoryItem_V1</A>
  <A N='Command'>Nup</A>
  <DICT N='Desc'>    <ITEMS>
    <S N='0'>裁切印张中未使用的空间： 无</S>
    <S N='1'>允许缩放页面： 无</S>
    <S N='2'>边距：左 ${marginLR_adj}mm，上 ${marginTB_adj}mm，右 ${marginLR_adj}mm，下 ${marginTB_adj}mm</S>
    <S N='3'>水平间距（点）： ${(hSpace / 0.352778).toFixed(2)}</S>
    <S N='4'>垂直间距（点）： ${(vSpace / 0.352778).toFixed(2)}</S>
    <S N='5'>流量： ${isDouble ? '双面（正-反-正-反...）' : '单面'}</S>
    <S N='6'>每页添加距： 无</S>
    <S N='7'>纸张尺寸： ${(layoutW / 25.4).toFixed(2)} x ${(layoutH / 25.4).toFixed(2)} inches / ${layoutW} x ${layoutH} mm</S>
    <S N='8'>印张方向： 最适合</S>
    <S N='9'>布局： 纵 ${rows} 行，横 ${cols} 列</S>
    <S N='10'>排列： 中心, 单独</S>
    <S N='11'>流量： ${isDouble ? '双面（正-反-正-反...）' : '单面'}</S>
    </ITEMS>  </DICT>
  <DICT N='Params'>    <ITEMS>
    <F N='BMgn'>${mm2pt(marginTB_adj)}</F>
    <F N='LMgn'>${mm2pt(marginLR_adj)}</F>
    <F N='RMgn'>${mm2pt(marginLR_adj)}</F>
    <F N='TMgn'>${mm2pt(marginTB_adj)}</F>
    <I N='FitAcross'>${typeof cols === 'number' ? cols : (scheme.cols || Math.max(scheme.maxCols1 || 0, scheme.maxCols2 || 0))}</I>
    <I N='FitDown'>${typeof rows === 'number' ? rows : (scheme.rows || ((scheme.rows1 || 0) + (scheme.rows2 || 0)))}</I>
    <S N='HSpace'>${(hSpace / 0.352778).toFixed(2)}</S>
    <S N='VSpace'>${(vSpace / 0.352778).toFixed(2)}</S>
    <F N='Height'>${(layoutH / 0.352778).toFixed(2)}</F>
    <F N='Width'>${(layoutW / 0.352778).toFixed(2)}</F>
    <A N='PageOrientation'>${pageOrientation}</A>
    <A N='SheetAlign'>${sheetAlign}</A>
    <A N='DoubleSideMode'>${doubleSideMode}</A>
    <B N='SheetAlignIndependent'>${sheetAlignIndependent}</B>
    <B N='CropMarks'>1</B>
    <A N='CropStyle'>Japanese</A>
    <F N='CropWidth'>0.2835</F>
    <F N='CropDist'>8.5039</F>
    <F N='CropLength'>28.3465</F>
    <F N='FixedScale'>0.3000</F>
    <B N='Frames'>0</B>
    <B N='NewDoc'>0</B>
    <B N='UseMgn'>1</B>
    <B N='UseScale'>0</B>
    <I N='UIVer'>2</I>
    <DICT N='Page'>      <ITEMS>
      <S N='Created'>D:${new Date().toISOString().replace(/-/g, '').replace(/:/g, '').substring(0, 15)}</S>
      <F N='Height'>${(layoutH / 0.352778).toFixed(2)}</F>
      <S N='Name'>${fileName}</S>
      <A N='Type'>Blank</A>
      <F N='Width'>${(layoutW / 0.352778).toFixed(2)}</F>
      </ITEMS>    </DICT>
    <DICT N='Source'>      <ITEMS>
      <A N='SourceType'>PDDoc</A>
      </ITEMS>    </DICT>
    </ITEMS>  </DICT>
  <I N='Version'>1</I>
  </ITEMS></DICT>
<A N='Category'>HistoryList_V1</A>
<S N='Requires'>qi2base</S>
</ITEMS>
</QUITEXML>`;

  try {
    fs.writeFileSync(xmlPath, xmlContent);
    console.log(`📝 生成XML配置文件: ${xmlPath}`);
    return xmlPath;
  } catch (error) {
    console.error('❌ 写入XML文件失败:', error);
    return null;
  }
}

module.exports = {
  generateXML,
  getBasePFromFileName,
  findParams,
  generateLockingString
};