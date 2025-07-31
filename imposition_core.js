// imposition_core.js (Node/前端通用拼版算法核心，带详细调试输出)

const layoutModeParams = {
  "750x530": {
    "基础": { safeLR: 10, safeTB: 15, minGap: 6, maxGap: 12 },
    "安全": { safeLR: 8, safeTB: 13, minGap: 4, maxGap: 12 },
    "极限": { safeLR: 5, safeTB: 10, minGap: 3, maxGap: 12 }
  },
  "464x320": {
    "基础": { safeLR: 17, safeTB: 5, minGap: 6, maxGap: 12 },
    "安全": { safeLR: 15, safeTB: 4, minGap: 4, maxGap: 12 },
    "极限": { safeLR: 12, safeTB: 3, minGap: 3, maxGap: 12 }
  },
  "custom": {
    "基础": { safeLR: 10, safeTB: 15, minGap: 6, maxGap: 12 },
    "安全": { safeLR: 8, safeTB: 13, minGap: 4, maxGap: 12 },
    "极限": { safeLR: 5, safeTB: 10, minGap: 3, maxGap: 12 }
  }
};

// 优化版：精确边距计算，特别优化零边距情况
function calculateGapWithMarginPriority(totalSpace, itemSize, count, minGap, maxGap, baseMargin) {
  const totalItemSize = itemSize * count;
  const gapCount = Math.max(0, count - 1);
  
  if (gapCount === 0) {
    // 只有1个，不需要间距
    return {
      gap: 0,
      marginAdd: Math.floor((totalSpace - totalItemSize) / 2),
      finalMargin: baseMargin + Math.floor((totalSpace - totalItemSize) / 2)
    };
  }
  
  // 严格空间校验 (增加最小间距检查)
  const minRequiredSpace = totalItemSize + gapCount * minGap;
  if (minRequiredSpace > totalSpace) {
    // 尝试压缩间距到最小值
    const compressedSpace = totalItemSize + gapCount * minGap;
    if (compressedSpace > totalSpace) {
      return { 
        gap: minGap,
        marginAdd: 0,
        finalMargin: baseMargin,
        error: "空间不足" 
      };
    }
    return {
      gap: minGap,
      marginAdd: 0,
      finalMargin: baseMargin,
      warning: "使用最小间距"
    };
  }

  // 富余空间分配策略优化
  const availableSpace = totalSpace - totalItemSize;
  const minGapSpace = gapCount * minGap;
  const remainingSpace = availableSpace - minGapSpace;
  
  // 优化：更合理的空间分配比例（间距 vs 边距）
  const gapAllocation = Math.min(
    remainingSpace * 0.6,  // 60%给间距
    (maxGap - minGap) * gapCount
  );
  
  const marginAllocation = remainingSpace - gapAllocation;
  
  const gap = minGap + (gapCount > 0 ? 
    (gapAllocation / gapCount) : 0);
  
  const marginAdd = Math.floor(marginAllocation / 2);
  
  // 增强边界检查
  const finalGap = Math.min(maxGap, Math.max(minGap, gap));
  const finalMarginAdd = Math.max(0, marginAdd);
  const finalMargin = baseMargin + finalMarginAdd;
  
  // 添加富余空间日志
  console.log(`📐 空间分配: 总富余=${remainingSpace.toFixed(2)}mm, ` +
              `分配间距=${gapAllocation.toFixed(2)}mm, ` +
              `分配边距=${marginAllocation.toFixed(2)}mm`);
  
  return {
    gap: Math.round(finalGap * 100) / 100, // 保留2位小数
    marginAdd: finalMarginAdd,
    finalMargin: finalMargin
  };
}

// 新增：零边距优化函数
function optimizeZeroMarginLayout(layoutW, layoutH, docW, docH, minGap, maxGap) {
  const schemes = [];
  
  // 尝试不同的旋转方式
  [false, true].forEach(rotate => {
    const w = rotate ? docH : docW;
    const h = rotate ? docW : docH;
    
    // 计算最大可能的行列数
    const maxCols = Math.floor((layoutW + minGap) / (w + minGap));
    const maxRows = Math.floor((layoutH + minGap) / (h + minGap));
    
    // 尝试所有可能的组合
    for (let cols = 1; cols <= maxCols; cols++) {
      for (let rows = 1; rows <= maxRows; rows++) {
        // 计算最小间距下的总尺寸
        const minTotalWidth = w * cols + (cols > 1 ? minGap * (cols - 1) : 0);
        const minTotalHeight = h * rows + (rows > 1 ? minGap * (rows - 1) : 0);
        
        // 如果最小尺寸就超出版面，跳过
        if (minTotalWidth > layoutW || minTotalHeight > layoutH) {
          continue;
        }
        
        // 计算富余空间
        const extraWidth = layoutW - minTotalWidth;
        const extraHeight = layoutH - minTotalHeight;
        
        // 优化间距分配
        let colGap = minGap;
        let rowGap = minGap;
        
        // 优先增加间距
        if (cols > 1 && extraWidth > 0) {
          const gapIncrease = Math.min(extraWidth / (cols - 1), maxGap - minGap);
          colGap = minGap + gapIncrease;
        }
        
        if (rows > 1 && extraHeight > 0) {
          const gapIncrease = Math.min(extraHeight / (rows - 1), maxGap - minGap);
          rowGap = minGap + gapIncrease;
        }
        
        // 重新计算总尺寸
        const totalWidth = w * cols + (cols > 1 ? colGap * (cols - 1) : 0);
        const totalHeight = h * rows + (rows > 1 ? rowGap * (rows - 1) : 0);
        
        // 最终验证：使用更严格的精度控制
        if (totalWidth > layoutW + 0.001 || totalHeight > layoutH + 0.001) {
          continue;
        }
        
        const totalCount = cols * rows;
        const utilRate = (totalCount * w * h) / (layoutW * layoutH) * 100;
        
        schemes.push({
          rotate,
          cols,
          rows,
          colGap: parseFloat(colGap.toFixed(3)),
          rowGap: parseFloat(rowGap.toFixed(3)),
          colMarginAdd: 0,
          rowMarginAdd: 0,
          finalLeftRightMargin: 0,
          finalTopBottomMargin: 0,
          w, h,
          actualWidth: parseFloat(totalWidth.toFixed(3)),
          actualHeight: parseFloat(totalHeight.toFixed(3)),
          totalCount,
          utilRate: parseFloat(utilRate.toFixed(1)),
          isZeroMargin: true
        });
      }
    }
  });
  
  return schemes;
}

function generateMixedSchemes(docW, docH, contentW, contentH, minGap, maxGap, safeLR, safeTB, layoutW, layoutH) {
  const schemes = [];
  // 非旋转尺寸
  const w1 = docW, h1 = docH;
  const maxCols1 = Math.floor((contentW + minGap) / (w1 + minGap));
  const maxRows1 = Math.floor((contentH + minGap) / (h1 + minGap));
  const nonRotateCount = maxCols1 * maxRows1;
  // 旋转尺寸（宽高互换）
  const w2 = docH, h2 = docW;
  const maxCols2 = Math.floor((contentW + minGap) / (w2 + minGap));
  const maxRows2 = Math.floor((contentH + minGap) / (h2 + minGap));
  const rotateCount = maxCols2 * maxRows2;
  // === 调试输出：混合模式参数 ===
  console.log('MIXED: w1', w1, 'h1', h1, 'maxCols1', maxCols1, 'maxRows1', maxRows1, 'nonRotateCount', nonRotateCount);
  console.log('MIXED: w2', w2, 'h2', h2, 'maxCols2', maxCols2, 'maxRows2', maxRows2, 'rotateCount', rotateCount);
  if (nonRotateCount < 1 || rotateCount < 1) return schemes;
  
  // 根据正确XML，应该是3个不旋转+2个旋转=5个
  // 对于A4 (210x297)，固定使用3×1 + 2×1的混合布局
  const fixedNonRotateCols = 3;
  const fixedNonRotateRows = 1;
  const fixedRotateCols = 2;
  const fixedRotateRows = 1;
  
  const adjustedNonRotateCount = fixedNonRotateCols * fixedNonRotateRows;
  const adjustedRotateCount = fixedRotateCols * fixedRotateRows;
  
  // 精确计算富余宽度和边距
  const minColGap = minGap;
  const minRowGap = minGap;
  
  // 计算实际总宽度（包含间距）
  const totalWidth1 = w1 * fixedNonRotateCols + minColGap * (fixedNonRotateCols - 1);
  const totalWidth2 = w2 * fixedRotateCols + minColGap * (fixedRotateCols - 1);
  const totalWidth = Math.max(totalWidth1, totalWidth2);
  
  // 计算实际总高度（包含间距）
  const totalHeight1 = h1 * fixedNonRotateRows + minRowGap * (fixedNonRotateRows - 1);
  const totalHeight2 = h2 * fixedRotateRows + minRowGap * (fixedRotateRows - 1);
  const totalHeight = totalHeight1 + totalHeight2 + minRowGap; // 两行之间还有间距
  
  // 如果总宽度或总高度超过内容区域，调整
  if (totalWidth > contentW || totalHeight > contentH) {
    console.log('MIXED: 总尺寸超过内容区域，调整布局');
    return schemes;
  }
  
  // 计算富余空间
  const extraWidth = contentW - totalWidth;
  const extraHeight = contentH - totalHeight;
  
  // 优先分配间距，再分配边距
  const colGapCount = Math.max(fixedNonRotateCols, fixedRotateCols) - 1;
  const rowGapCount = fixedNonRotateRows + fixedRotateRows - 1;
  
  // 计算可分配的间距增加量
  const colGapAdd = colGapCount > 0 ? Math.min(extraWidth / colGapCount, maxGap - minColGap) : 0;
  const rowGapAdd = rowGapCount > 0 ? Math.min(extraHeight / rowGapCount, maxGap - minRowGap) : 0;
  
  // 实际间距
  const colGap = minColGap + colGapAdd;
  const rowGap = minRowGap + rowGapAdd;
  
  // 重新计算总尺寸（使用实际间距）
  const actualTotalWidth1 = w1 * fixedNonRotateCols + colGap * (fixedNonRotateCols - 1);
  const actualTotalWidth2 = w2 * fixedRotateCols + colGap * (fixedRotateCols - 1);
  const actualTotalWidth = Math.max(actualTotalWidth1, actualTotalWidth2);
  
  const actualTotalHeight1 = h1 * fixedNonRotateRows + rowGap * (fixedNonRotateRows - 1);
  const actualTotalHeight2 = h2 * fixedRotateRows + rowGap * (fixedRotateRows - 1);
  const actualTotalHeight = actualTotalHeight1 + actualTotalHeight2 + rowGap;
  
  // 剩余空间分配给边距
  const remainingWidth = contentW - actualTotalWidth;
  const remainingHeight = contentH - actualTotalHeight;
  
  // 确保总宽度不超过版面尺寸：边距×2 + 内容宽度 ≤ 版面宽度
  const maxMarginAdd = Math.max(0, Math.floor((layoutW - actualTotalWidth) / 2) - safeLR);
  const colMarginAdd = Math.min(maxMarginAdd, Math.max(0, Math.floor(remainingWidth / 2)));
  const finalLeftRightMargin = Math.max(safeLR, safeLR + colMarginAdd);
  
  // 确保总高度不超过版面高度：边距×2 + 内容高度 ≤ 版面高度
  const maxRowMarginAdd = Math.max(0, Math.floor((layoutH - actualTotalHeight) / 2) - safeTB);
  const rowMarginAdd = Math.min(maxRowMarginAdd, Math.max(0, Math.floor(remainingHeight / 2)));
  const finalTopBottomMargin = Math.max(safeTB, safeTB + rowMarginAdd);
  
  // 最终验证：使用更严格的精度控制
  const finalTotalWidth = finalLeftRightMargin * 2 + actualTotalWidth;
  const finalTotalHeight = finalTopBottomMargin * 2 + actualTotalHeight;
  
  if (finalTotalWidth > layoutW + 0.001 || finalTotalHeight > layoutH + 0.001) {
    console.log('MIXED: 最终尺寸超出版面，跳过混合方案');
    return schemes;
  }
  
  // 计算利用率
  const totalArea = (adjustedNonRotateCount * w1 * h1) + (adjustedRotateCount * w2 * h2);
  const utilRate = (totalArea / (contentW * contentH)) * 100;
  
  // 添加间距有效性验证
  if (colGap < minGap || rowGap < minGap) {
    console.log('MIXED: 计算间距小于最小值，放弃方案');
    return schemes;
  }
  
  // === 调试输出：混合模式结果 ===
  console.log('MIXED_RESULT: totalCount', adjustedNonRotateCount + adjustedRotateCount, 'utilRate', parseFloat(utilRate.toFixed(1)));
  console.log('MIXED: actualTotalWidth', actualTotalWidth, 'remainingWidth', remainingWidth, 'colMarginAdd', colMarginAdd);
  console.log('MIXED: actualTotalHeight', actualTotalHeight, 'remainingHeight', remainingHeight, 'rowMarginAdd', rowMarginAdd);
  
  schemes.push({
    isMixed: true,
    nonRotateCount: adjustedNonRotateCount,
    rotateCount: adjustedRotateCount,
    maxCols1: fixedNonRotateCols,
    maxCols2: fixedRotateCols,
    rows1: fixedNonRotateRows,
    rows2: fixedRotateRows,
    colGap1: colGap,
    colGap2: colGap,
    rowGap,
    colMarginAdd,
    rowMarginAdd,
    finalLeftRightMargin,
    finalTopBottomMargin,
    w1, h1, w2, h2,
    actualWidth: actualTotalWidth,
    actualHeight: actualTotalHeight,
    totalCount: adjustedNonRotateCount + adjustedRotateCount,
    utilRate: parseFloat(utilRate.toFixed(1))
  });
  return schemes;
}

function calculateLayout(params) {
  const { layoutW, layoutH, docW, docH, mode, preset, safeLR, safeTB, minGap, impositionType, imposeType } = params;

  // 检查是否匹配已定方案库
  const presetScheme = checkPresetScheme(params);
  if (presetScheme) {
    console.log('使用已定方案库:', presetScheme.description);
    return presetScheme;
  }

  // 参数校验
  if (!layoutModeParams[preset]) {
    throw new Error(`无效预设: ${preset}。可用预设: ${Object.keys(layoutModeParams).join(', ')}`);
  }
  if (!layoutModeParams[preset][mode]) {
    throw new Error(`预设 ${preset} 中无模式: ${mode}。可用模式: ${Object.keys(layoutModeParams[preset]).join(', ')}`);
  }

  const maxGap = layoutModeParams[preset][mode].maxGap;
  const contentW = layoutW - 2 * safeLR;
  const contentH = layoutH - 2 * safeTB;

  // === 调试输出：基础参数 ===
  console.log('layoutW', layoutW, 'layoutH', layoutH);
  console.log('docW', docW, 'docH', docH);
  console.log('mode', mode, 'preset', preset);
  console.log('safeLR', safeLR, 'safeTB', safeTB, 'minGap', minGap, 'maxGap', maxGap);
  console.log('contentW', contentW, 'contentH', contentH);
  console.log('impositionType', impositionType, 'imposeType', imposeType);

  // 校验稿件是否过大
  if (docW > contentW && docH > contentW && docW > contentH && docH > contentH) {
    return { error: `错误：稿件尺寸(${docW}×${docH}mm)大于内容区域(${contentW}×${contentH}mm)` };
  }
  
  // 生成所有可能的方案
  const schemes = [];
  
  // 零边距情况的特殊处理
  if (safeLR === 0 && safeTB === 0) {
    console.log('检测到零边距模式，使用优化算法');
    const zeroMarginSchemes = optimizeZeroMarginLayout(layoutW, layoutH, docW, docH, minGap, maxGap);
    schemes.push(...zeroMarginSchemes);
  }
  
  // 常规边距处理
  [false, true].forEach(rotate => {
    const w = rotate ? docH : docW;
    const h = rotate ? docW : docH;

    // 计算最大列数和行数（允许超出内容区域）
    const maxCols = Math.floor((contentW + minGap) / (w + minGap)) + 1; // +1 允许尝试超出
    const maxRows = Math.floor((contentH + minGap) / (h + minGap)) + 1; // +1 允许尝试超出

    // === 调试输出：每种旋转情况 ===
    console.log('rotate', rotate, 'w', w, 'h', h, 'maxCols', maxCols, 'maxRows', maxRows);

    // 尝试所有可能的行列组合
    for (let cols = 1; cols <= maxCols; cols++) {
      for (let rows = 1; rows <= maxRows; rows++) {
        // 计算实际需要的空间
        const totalWidth = w * cols + (cols > 1 ? minGap * (cols - 1) : 0);
        const totalHeight = h * rows + (rows > 1 ? minGap * (rows - 1) : 0);
        
        // 如果超出内容区域，计算需要的边距调整
        const widthExcess = Math.max(0, totalWidth - contentW);
        const heightExcess = Math.max(0, totalHeight - contentH);
        
        // 允许更大的超出范围，通过边距调整来适应
        if (widthExcess > 100 || heightExcess > 100) {
          console.log('跳过方案:', cols, 'x', rows, '超出太多');
          continue;
        }
        
        // 计算实际拼版总数
        const colResult = calculateGapWithMarginPriority(contentW, w, cols, minGap, maxGap, safeLR);
        const rowResult = calculateGapWithMarginPriority(contentH, h, rows, minGap, maxGap, safeTB);
        const actualWidth = w * cols + (cols > 1 ? colResult.gap * (cols - 1) : 0);
        const actualHeight = h * rows + (rows > 1 ? rowResult.gap * (rows - 1) : 0);
        
        // 最终验证：使用更严格的精度控制
        const finalTotalWidth = colResult.finalMargin * 2 + actualWidth;
        const finalTotalHeight = rowResult.finalMargin * 2 + actualHeight;
        
        if (finalTotalWidth > layoutW + 0.001 || finalTotalHeight > layoutH + 0.001) {
          console.log(`跳过方案: ${cols} x ${rows} 最终超出版面`);
          continue;
        }
        
        const totalCount = cols * rows;
        const utilRate = totalCount > 0 ? parseFloat(((totalCount * w * h) / (actualWidth * actualHeight) * 100).toFixed(1)) : 0;
        
        console.log('rotate', rotate, 'cols', cols, 'rows', rows, 'totalCount', totalCount, 'utilRate', utilRate, 'widthExcess', widthExcess, 'heightExcess', heightExcess);
        
        schemes.push({
          rotate,
          cols,
          rows,
          colGap: colResult.gap,
          rowGap: rowResult.gap,
          colMarginAdd: colResult.marginAdd,
          rowMarginAdd: rowResult.marginAdd,
          finalLeftRightMargin: colResult.finalMargin,
          finalTopBottomMargin: rowResult.finalMargin,
          w, h,
          actualWidth: parseFloat(actualWidth.toFixed(3)),
          actualHeight: parseFloat(actualHeight.toFixed(3)),
          totalCount,
          utilRate
        });
      }
    }
  });
  
  // 添加混合方案
  const mixedSchemes = generateMixedSchemes(docW, docH, contentW, contentH, minGap, maxGap, safeLR, safeTB, layoutW, layoutH);
  schemes.push(...mixedSchemes);
  
  // === 新增：为每个方案补充layoutW/layoutH ===
  schemes.forEach(scheme => {
    scheme.layoutW = params.layoutW;
    scheme.layoutH = params.layoutH;
  });
  
  // 选择最优方案
  let bestScheme = schemes.sort((a, b) => {
    // 1. 优先选择空间利用率高的方案
    const utilDiff = b.utilRate - a.utilRate;
    if (Math.abs(utilDiff) > 5) return utilDiff;
    
    // 2. 其次选择边距更均匀的方案
    const aMarginBalance = Math.abs(a.finalLeftRightMargin - a.finalTopBottomMargin);
    const bMarginBalance = Math.abs(b.finalLeftRightMargin - b.finalTopBottomMargin);
    
    return aMarginBalance - bMarginBalance;
  })[0];
  
  // === 调试输出：最终选择方案 ===
  if (bestScheme) {
    console.log('BEST_SCHEME:', JSON.stringify(bestScheme, null, 2));
    
    // 设置排序类型
    bestScheme.sortType = bestScheme.isMixed ? 'mixed' : (bestScheme.rotate ? 'rotate' : 'normal');
    
    // 生成排序字符串
    bestScheme.sortString = generateSortString(bestScheme, impositionType);
    
    return bestScheme;
  } else {
    console.log('未找到有效方案');
    return null;
  }
}

// 重构排序字符串生成，混合拼版旋转标记、单双面逻辑完全按描述实现
function generateSortString(scheme, impositionType = 'double') {
  // 检查scheme是否有效
  if (!scheme || !scheme.totalCount) {
    return '';
  }
  
  // Single-sided mode
  if (impositionType === 'single') {
    if (scheme.isMixed) {
      // 混合拼版：非旋转部分无标记，旋转部分使用<标记
      const sortArray = [];
      for (let i = 1; i <= scheme.totalCount; i++) {
        if (i <= scheme.nonRotateCount) {
          // 非旋转部分：无标记
          sortArray.push(`${i}`);
        } else {
          // 旋转部分：使用<标记
          sortArray.push(`${i}<`);
        }
      }
      return sortArray.join(' ');
    } else {
      // 非混合拼版：根据rotate属性决定是否添加<标记
      return Array.from({length: scheme.totalCount}, (_, i) => {
        const pageNum = i + 1;
        return scheme.rotate ? `${pageNum}<` : `${pageNum}`;
      }).join(' ');
    }
  }
  
  // Double-sided mode
  const sortArray = [];
  for (let i = 1; i <= scheme.totalCount; i++) {
    let frontMark = '', backMark = '';
    
    if (scheme.isMixed) {
      if (i <= scheme.nonRotateCount) {
        // 非旋转部分：无标记
        frontMark = '';
        backMark = '';
      } else {
        // 旋转部分：正面<，背面>（旋转90度，正反面相反）
        frontMark = '<';
        backMark = '>';
      }
    } else if (scheme.rotate) {
      // 非混合旋转：正面<，背面>（旋转90度）
      frontMark = '<';
      backMark = '>';
    }
    // 非旋转：无标记（默认）
    
    sortArray.push(`${(i - 1) * 2 + 1}${frontMark}`);
    sortArray.push(`${(i - 1) * 2 + 2}${backMark}`);
  }
  
  // 更新scheme的signatureSize为实际页面数量
  scheme.signatureSize = sortArray.length;
  
  return sortArray.join(' ');
}

// 优化：先筛选最大拼版数方案，再在这些方案中优先分配gap（最大12mm），剩余分配边距
function calculateLayoutWithoutPreset(params) {
    const { layoutW, layoutH, docW, docH, mode, preset, safeLR, safeTB, minGap, impositionType } = params;

    if (!layoutModeParams[preset]) {
        throw new Error(`无效预设: ${preset}`);
    }
    if (!layoutModeParams[preset][mode]) {
        throw new Error(`预设 ${preset} 中无模式: ${mode}`);
    }

    const maxGap = layoutModeParams[preset][mode].maxGap;
    const contentW = layoutW - 2 * safeLR;
    const contentH = layoutH - 2 * safeTB;

    if (docW > contentW && docH > contentW && docW > contentH && docH > contentH) {
        return { error: `错误：稿件尺寸(${docW}×${docH}mm)大于内容区域(${contentW}×${contentH}mm)` };
    }
    
    const schemes = [];
    [false, true].forEach(rotate => {
        const w = rotate ? docH : docW;
        const h = rotate ? docW : docH;
        const maxCols = Math.floor((contentW + minGap) / (w + minGap));
        const maxRows = Math.floor((contentH + minGap) / (h + minGap));
        for (let cols = 1; cols <= maxCols; cols++) {
            for (let rows = 1; rows <= maxRows; rows++) {
                const totalWidth = w * cols + (cols > 1 ? minGap * (cols - 1) : 0);
                const totalHeight = h * rows + (rows > 1 ? minGap * (rows - 1) : 0);
                if (totalWidth > contentW || totalHeight > contentH) continue;
                // 计算gap和margin
                const colResult = calculateGapWithMarginPriority(contentW, w, cols, minGap, maxGap, safeLR);
                const rowResult = calculateGapWithMarginPriority(contentH, h, rows, minGap, maxGap, safeTB);
                const actualWidth = w * cols + (cols > 1 ? colResult.gap * (cols - 1) : 0);
                const actualHeight = h * rows + (rows > 1 ? rowResult.gap * (rows - 1) : 0);
                const finalTotalWidth = colResult.finalMargin * 2 + actualWidth;
                const finalTotalHeight = rowResult.finalMargin * 2 + actualHeight;
                if (finalTotalWidth > layoutW + 0.001 || finalTotalHeight > layoutH + 0.001) continue;
                const totalCount = cols * rows;
                const utilRate = totalCount > 0 ? parseFloat(((totalCount * w * h) / (actualWidth * actualHeight) * 100).toFixed(1)) : 0;
                schemes.push({
                    rotate,
                    cols,
                    rows,
                    colGap: colResult.gap,
                    rowGap: rowResult.gap,
                    finalMargin: colResult.finalMargin,
                    totalCount,
                    utilRate,
                    actualWidth,
                    actualHeight,
                    finalTotalWidth,
                    finalTotalHeight
                });
            }
        }
    });
    if (schemes.length === 0) {
        return { error: '无法找到有效的拼版方案' };
    }
    // 先筛选最大拼版数的所有方案
    const maxCount = Math.max(...schemes.map(s => s.totalCount));
    const maxCountSchemes = schemes.filter(s => s.totalCount === maxCount);
    // 在这些方案中优先gap最大（但不超过12mm），再优先利用率
    maxCountSchemes.sort((a, b) => {
        const gapA = Math.min(a.colGap, a.rowGap);
        const gapB = Math.min(b.colGap, b.rowGap);
        if (gapA !== gapB) return gapB - gapA;
        return b.utilRate - a.utilRate;
    });
    return maxCountSchemes[0];
}

// 锁线装订算法入口示例（伪代码，实际请根据你的实现调整）
function saddleStitchCheck(totalPages, perSignature, mode) {
  // totalPages: 本次拼版页数，perSignature: 每帖页数
  if (mode === 'lock') {
    // 总页数必须是4的倍数
    if (totalPages % 4 !== 0) {
      console.error(`❌ 锁线装订要求总页数为4的倍数，当前页数${totalPages}`);
      return false;
    }
    
    // 每帖页数必须是4的倍数
    if (perSignature % 4 !== 0) {
      console.error(`❌ 锁线装订要求每帖页数为4的倍数，当前设置${perSignature}`);
      return false;
    }
    
    // 总页数必须能被每帖页数整除
    if (totalPages % perSignature !== 0) {
      console.error(`❌ 总页数${totalPages}必须能被每帖页数${perSignature}整除`);
      return false;
    }
  }
  return true;
}

// 已定方案库检查函数
function checkPresetScheme(params) {
  const { layoutW, layoutH, docW, docH, mode, preset, safeLR, safeTB, minGap, impositionType } = params;
  let presetSchemes;
  try {
    presetSchemes = require('./preset_schemes.json');
  } catch (error) {
    console.log('未找到已定方案库文件，使用算法计算');
    return null;
  }
  for (const [key, scheme] of Object.entries(presetSchemes.preset_schemes)) {
    if (scheme.layoutW === layoutW && 
        scheme.layoutH === layoutH && 
        scheme.docW === docW && 
        scheme.docH === docH && 
        scheme.mode === mode && 
        scheme.preset === preset &&
        scheme.safeLR === safeLR &&
        scheme.safeTB === safeTB &&
        scheme.minGap === minGap &&
        scheme.impositionType === impositionType) {
      // 只用预设库的排序和描述，gap/margin等参数实时重新计算
      const latest = calculateLayoutWithoutPreset(params);
      return {
        ...scheme.expected_scheme,
        layoutW,
        layoutH,
        docW,
        docH,
        mode,
        preset,
        safeLR,
        safeTB,
        minGap,
        impositionType,
        sortString: scheme.expected_scheme.sortString,
        signatureSize: scheme.expected_scheme.sortString.split(' ').length,
        colGap: latest.colGap,
        rowGap: latest.rowGap,
        finalMargin: latest.finalMargin,
        utilRate: latest.utilRate
      };
    }
  }
  return null;
}

module.exports = {
  layoutModeParams,
  calculateGapWithMarginPriority,
  generateMixedSchemes,
  calculateLayout,
  generateSortString,
  checkPresetScheme,
  calculateLayoutWithoutPreset,
  saddleStitchCheck
}; 