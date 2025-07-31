// impositionService.js
const fs = require('fs');
const path = require('path');
const config = require('./config');
const xmlGenerator = require('./xmlGenerator');
const utils = require('./utils');
const { exec, execSync } = require('child_process');

async function processTask(task) {
  const { filePath, fileName, adjustedScheme, type, fullSets, remainder, layout, dimensions, mode, modeKey } = task;
  console.log('[Task] 任务参数:', { fileName, fullSets, remainder, type, mode, dimensions, layout });
  
  // 处理满拼部分
  if (fullSets > 0) {
    await processFullSet(filePath, fileName, adjustedScheme, type, fullSets);
  }
  
  // 处理余数部分
  if (remainder > 0) {
    await processRemainder(filePath, fileName, layout, dimensions, modeKey, type, remainder);
  }
  
  console.log(`[Task] 处理完成: ${fileName}`);
}

async function processFullSet(filePath, fileName, scheme, type, fullSets) {
  const utils = require('./utils');
  const outputFileName = `full_${path.basename(fileName, '.pdf')}_${Date.now()}.pdf`;
  const fullXmlPath = path.join(config.TEMP_DIR, `autoxml_full_${Date.now()}.xml`);
  const copies = fullSets * scheme.totalCount; // 满拼实际份数
  const adjustedScheme = utils.adjustSorting(scheme, type.isSingle, type.imposeType);
  xmlGenerator.generateXML(adjustedScheme, type, copies, outputFileName, fullXmlPath);
  if (fs.existsSync(fullXmlPath)) {
    const xmlContent = fs.readFileSync(fullXmlPath, 'utf8');
    console.log('[FullSet] XML文件:', fullXmlPath, '内容摘要:', xmlContent.slice(0, 200));
  }
  const tempOutputPath = await executeImposition(filePath, outputFileName, fullXmlPath);
  console.log(`[FullSet] 满拼输出: ${tempOutputPath}`);
  if (fs.existsSync(tempOutputPath)) {
    console.log('[FullSet] 输出PDF存在:', tempOutputPath);
  } else {
    console.error('[FullSet] 输出PDF不存在:', tempOutputPath);
  }
  // 清理临时XML
  if (fs.existsSync(fullXmlPath)) {
    fs.unlinkSync(fullXmlPath);
    console.log(`[FullSet] 清理临时XML: ${fullXmlPath}`);
  }
}

async function processRemainder(filePath, fileName, layout, dimensions, modeKey, type, remainder) {
  const utils = require('./utils');
  const layoutModeKey = utils.getLayoutModeKey(layout.width, layout.height);
  // 获取正确的预设值
  const preset = layoutModeKey;
  const layoutParams = utils.layoutModeParams[layoutModeKey] && utils.layoutModeParams[layoutModeKey][config.MODE_MAP[modeKey]];
  if (!layoutParams) {
    console.error('❌ 无法获取拼版参数模板');
    return;
  }
  // 组装参数对象，调用新版 calculateLayout
  const remainderScheme = utils.calculateLayout({
    layoutW: layout.width,
    layoutH: layout.height,
    docW: dimensions.width,
    docH: dimensions.height,
    mode: config.MODE_MAP[modeKey],
    preset: preset,  // 添加预设参数
    safeLR: layoutParams.safeLR,
    safeTB: layoutParams.safeTB,
    minGap: layoutParams.minGap,
    impositionType: type.isSingle ? 'single' : 'double'
  });
  if (!remainderScheme) {
    console.error('❌ 无法计算余数拼版方案');
    return;
  }
  const validCount = Math.min(remainder, remainderScheme.totalCount);
  remainderScheme.totalCount = validCount;
  const adjustedScheme = utils.adjustSorting(remainderScheme, type.isSingle, type.imposeType);
  const outputFileName = `remainder_${path.basename(fileName, '.pdf')}_${Date.now()}.pdf`;
  const remainderXmlPath = path.join(config.TEMP_DIR, `autoxml_remainder_${Date.now()}.xml`);
  const copies = remainder; // 余数实际份数
  xmlGenerator.generateXML(adjustedScheme, type, copies, outputFileName, remainderXmlPath);
  if (fs.existsSync(remainderXmlPath)) {
    const xmlContent = fs.readFileSync(remainderXmlPath, 'utf8');
    console.log('[Remainder] XML文件:', remainderXmlPath, '内容摘要:', xmlContent.slice(0, 200));
  }
  const tempOutputPath = await executeImposition(filePath, outputFileName, remainderXmlPath);
  console.log(`[Remainder] 余数拼版输出: ${tempOutputPath}`);
  if (fs.existsSync(tempOutputPath)) {
    console.log('[Remainder] 输出PDF存在:', tempOutputPath);
  } else {
    console.error('[Remainder] 输出PDF不存在:', tempOutputPath);
  }
  // 清理临时XML
  if (fs.existsSync(remainderXmlPath)) {
    fs.unlinkSync(remainderXmlPath);
    console.log(`[Remainder] 清理临时XML: ${remainderXmlPath}`);
  }
}

function executeImposition(inputPath, outputFileName, xmlPath) {
  return new Promise((resolve, reject) => {
    const outputDir = config.OUTPUT_DIR;
    const outputPath = path.join(outputDir, outputFileName.endsWith('.pdf') ? outputFileName : `${outputFileName}.pdf`);
    // 使用官方推荐的 qi_applycommands.exe
    const qhiCmd = '"C:\\Program Files (x86)\\Quite\\Quite Hot Imposing 5\\qi_applycommands.exe"';
    const cmd = `${qhiCmd} -control "${xmlPath}" -source "${inputPath}" -target "${outputPath}"`;
    console.log('[Imposition] 执行命令:', cmd);

    killQHIProcess(); // 自动杀进程，防止多实例

    const startTime = Date.now();
    const { exec } = require('child_process');
    const child = exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ 执行错误: ${error.message}`);
        if (stderr) console.error('❌ QHI 错误输出:', stderr);
        reject(error);
        return;
      }
      if (stderr) console.error('⚠️ QHI 警告:', stderr);
      if (stdout) console.log('💬 QHI 输出:', stdout);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ 拼版完成 (耗时: ${duration}秒)`);
      // 输出文件名由 XML 决定，通常和输入 PDF 同名
      if (fs.existsSync(outputPath)) {
        console.log('[Imposition] 输出PDF存在:', outputPath);
      } else {
        console.error('[Imposition] 输出PDF不存在:', outputPath);
      }
      resolve(outputPath);
    });

    // 添加超时处理
    const timeout = setTimeout(() => {
      console.error('⏱️ 命令执行超时，终止进程');
      child.kill();
      reject(new Error('Command timeout'));
    }, config.COMMAND_TIMEOUT);

    child.on('exit', () => clearTimeout(timeout));
  });
}

// 杀死所有 QHI 进程
function killQHIProcess() {
  try {
    execSync('taskkill /IM qi_hot.exe /F');
    console.log('已结束所有 Quite Hot Imposing 进程');
  } catch (e) {
    // 没有进程时会报错，忽略即可
  }
}

module.exports = {
  processTask
};