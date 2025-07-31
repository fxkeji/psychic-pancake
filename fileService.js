// fileService.js
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const queueManager = require('./queueManager');
const utils = require('./utils');

let watcher;

function ensureDirectories() {
  [config.INPUT_DIR, config.OUTPUT_DIR, config.TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`创建目录: ${dir}`);
    }
  });
}

function startWatching() {
  ensureDirectories();
  
  console.log(`开始监控目录: ${config.INPUT_DIR}`);
  watcher = chokidar.watch(config.INPUT_DIR, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: config.FILE_STABILITY_THRESHOLD,
      pollInterval: 500
    }
  });

  watcher.on('add', async (filePath) => {
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      console.log(`\n📥 检测到新PDF文件: ${filePath}`);
      await processNewFile(filePath);
    }
  });
}

async function processNewFile(filePath) {
  const fileName = path.basename(filePath);
  const prefix = fileName.substring(0, 5);
  
  // 验证文件名格式
  if (prefix.length < 5) {
    console.error(`❌ 文件名格式错误: ${fileName}`);
    return;
  }
  
  // 提取参数
  const layoutKey = prefix.substring(0, 2);
  const typeKey = prefix.substring(2, 4);
  const modeKey = prefix.substring(4, 5).toUpperCase();
  
  // 检查旋转标志
  const rotateFlag = prefix.length > 2 ? prefix[2] : null;
  
  // 获取配置
  let layout = config.LAYOUT_MAP[layoutKey];
  const type = config.TYPE_MAP[typeKey];
  const mode = config.MODE_MAP[modeKey];
  
  if (!layout || !type || !mode) {
    console.error(`❌ 无效的配置参数: ${prefix}`);
    console.log(`可用版面: ${Object.keys(config.LAYOUT_MAP).join(', ')}`);
    console.log(`可用类型: ${Object.keys(config.TYPE_MAP).join(', ')}`);
    console.log(`可用模式: ${Object.keys(config.MODE_MAP).join(', ')}`);
    return;
  }
  
  // 处理旋转版面
  if (layout && rotateFlag && rotateFlag.toLowerCase() === 'r') {
    // 旋转版面：交换宽高
    layout = {
      width: layout.height,
      height: layout.width,
      rotatable: true,
      rotated: true  // 明确标记已旋转
    };
    console.log(`🔄 启用旋转版面: ${layout.width}×${layout.height}mm`);
  }
  
  console.log(`✅ 解析配置: 版面=${layoutKey} (${layout.width}×${layout.height}mm), 类型=${type.name}, 模式=${mode}`);
  
  // 提取份数
  let quantity = utils.extractQuantity(fileName);
  if (!quantity || isNaN(quantity)) {
    quantity = 20; // 默认值
    console.warn(`⚠️ 文件名未含份数，使用默认值：${quantity}`);
  }
  console.log(`📦 计算份数: ${quantity}`);
  
  // 获取PDF尺寸
  const dimensions = await utils.getPdfDimensions(filePath);
  if (!dimensions) {
    console.error('❌ 无法获取PDF尺寸');
    return;
  }
  
  console.log(`📏 稿件尺寸: ${dimensions.width}×${dimensions.height}mm`);
  
  // 获取 layoutModeParams 的 key（自动映射）
  let layoutModeKey = null;
  if (layout.width === 750 && layout.height === 530) layoutModeKey = "750x530";
  else if (layout.width === 464 && layout.height === 320) layoutModeKey = "464x320";
  else layoutModeKey = "custom";

  // 自动映射 mode 到标准key
  // config.MODE_MAP 可能是 { 'J': '极限', 'A': '安全', ... }
  // layoutModeParams 需要 '极限'、'安全'、'基础' 这类key
  // 这里mode已经是'极限'、'安全'等字符串
  const validModes = ["极限", "安全", "基础"];
  let modeKeyForParams = validModes.includes(mode) ? mode : "极限"; // 默认极限

  // 日志输出映射结果
  console.log(`映射后 layoutModeKey=${layoutModeKey}, modeKeyForParams=${modeKeyForParams}`);

  const layoutParams = utils.layoutModeParams[layoutModeKey] && utils.layoutModeParams[layoutModeKey][modeKeyForParams];
  if (!layoutParams) {
    console.error('❌ 无法获取拼版参数模板');
    return;
  }

  // 组装参数对象，调用新版 calculateLayout
  const scheme = utils.calculateLayout({
    layoutW: layout.width,
    layoutH: layout.height,
    docW: dimensions.width,
    docH: dimensions.height,
    mode: modeKeyForParams,
    preset: layoutModeKey,
    safeLR: layoutParams.safeLR,
    safeTB: layoutParams.safeTB,
    minGap: layoutParams.minGap,
    impositionType: type.isSingle ? 'single' : 'double'
  });
  
  if (!scheme) {
    console.error('❌ 无法计算拼版方案');
    return;
  }

  // 直接用imposition_core.generateSortString生成排序字符串
  const imposition_core = require('./imposition_core');
  const sortString = imposition_core.generateSortString(scheme, type.isSingle ? 'single' : 'double');
  scheme.sortString = sortString;
  
  // 统一帖数为排序字符串长度
  const actualSignatureSize = sortString.split(' ').length;
  
  // 添加详细的间距和边距信息输出
  console.log(`🧩 拼版方案: ${actualSignatureSize}${type.isSingle ? '' : '（双面物理页数=' + actualSignatureSize + '）'}个, 排序: ${scheme.sortString}`);
  
  // 输出间距和边距详细信息
  if (scheme.colGap !== undefined && scheme.rowGap !== undefined) {
    console.log(`📐 间距分配: 列间距=${scheme.colGap}mm, 行间距=${scheme.rowGap}mm`);
  }
  if (scheme.finalMargin !== undefined) {
    console.log(`📏 边距分配: 左右边距=${scheme.finalMargin}mm, 上下边距=${scheme.finalMargin}mm`);
  }
  if (scheme.utilRate !== undefined) {
    console.log(`📊 利用率: ${scheme.utilRate}%`);
  }
  if (scheme.rotate !== undefined) {
    console.log(`🔄 旋转状态: ${scheme.rotate ? '已旋转' : '未旋转'}`);
  }
  
  // 添加空间分配详细信息
  if (scheme.colExtra !== undefined || scheme.rowExtra !== undefined) {
    console.log(`📐 空间分配: 列=${scheme.colGap}mm, 行=${scheme.rowGap}mm, ` +
                `富余空间: 列${scheme.colExtra || 0}mm, 行${scheme.rowExtra || 0}mm`);
  }

  // 处理份数余数，使用实际帖数计算
  const pagePerSet = actualSignatureSize;
  const fullSets = Math.floor(quantity / pagePerSet);
  const remainder = quantity % pagePerSet;

  // 锁线装订校验（主拼版）
  if (type.binding === 'lock') {
    const imposition_core = require('./imposition_core');
    if (!imposition_core.saddleStitchCheck(pagePerSet, type.signaturePages, 'lock')) {
      console.error(`❌ 锁线装订校验失败：主拼版页数${pagePerSet}`);
    }
  }

  console.log(`🧮 份数计算: 总数=${quantity}, 满拼=${fullSets}套, 余数=${remainder}份`);

  // 将任务添加到队列
  queueManager.addToQueue({
    filePath,
    fileName,
    adjustedScheme: scheme,
    type,
    fullSets,
    remainder,
    mode
  });

  // 余数拼版处理（如有余数，单独生成余数拼版方案和排序字符串）
  if (remainder > 0) {
    // 修正：使用实际拼版数量计算余数组大小
    const remainderGroupSize = type.isSingle ? 
      scheme.totalCount : 
      scheme.totalCount * 2;
    
    // 深拷贝方案避免污染
    const remainderScheme = {...scheme};
    remainderScheme.totalCount = remainderGroupSize;
    
    // 重新生成排序字符串
    remainderScheme.sortString = imposition_core.generateSortString(
      remainderScheme, 
      type.isSingle ? 'single' : 'double'
    );
    
    // 锁线装订校验（余数拼版）
    if (type.binding === 'lock') {
      const imposition_core = require('./imposition_core');
      if (!imposition_core.saddleStitchCheck(remainderGroupSize, type.signaturePages, 'lock')) {
        console.error(`❌ 锁线装订校验失败：余数拼版页数${remainderGroupSize}`);
      }
    }
    
    // 添加任务到队列
    queueManager.addToQueue({
      filePath,
      fileName,
      adjustedScheme: remainderScheme,
      type,
      fullSets: 0,
      remainder: remainder,
      layout,
      dimensions,
      mode,
      modeKey,
      remainderGroupSize,
      isRemainder: true // 明确标记为余数拼版
    });
    
    // 添加日志
    console.log(`🧩 余数拼版方案: Group size=${remainderGroupSize}, Copies=${remainder}`);
  }
}

function stopWatching() {
  if (watcher) {
    watcher.close();
  }
}

module.exports = {
  startWatching,
  stopWatching,
  ensureDirectories
};