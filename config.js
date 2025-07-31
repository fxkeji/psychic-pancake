// config.js
const path = require('path');

module.exports = {
  // 基本路径配置
  QHI_PATH: '"C:\\Program Files (x86)\\Quite\\Quite Hot Imposing 5\\qi_applycommands.exe"',
  INPUT_DIR: path.join(__dirname, '++'),
  OUTPUT_DIR: path.join(__dirname, 'out'),
  TEMP_DIR: path.join(__dirname, 'temp'),
  // LOCK_FILE: path.join(__dirname, 'app.lock'),

  // 拼版配置映射
  LAYOUT_MAP: {
    'W2': { width: 750, height: 530, rotatable: true },
    'HP': { width: 464, height: 320, rotatable: true }
  },

  MODE_MAP: {
    'A': '基础',
    'B': '安全',
    'C': '极限'
  },

  TYPE_MAP: {
    '11': { name: '单面联拼', isSingle: true, imposeType: 'Imposition' },
    '22': { name: '双面联拼', isSingle: false, imposeType: 'Imposition' },
    '01': { name: '连续折手', isSingle: true, imposeType: 'Imposition' },
    '14': { name: '单面堆叠', isSingle: true, imposeType: 'CutStacks' },
    '15': { name: '双面堆叠', isSingle: false, imposeType: 'CutStacksDouble' },
    '81': { name: '骑马钉', isSingle: false, imposeType: 'Imposition' },
    '08': { name: '8P锁线', isSingle: false, imposeType: 'Imposition' },
    '12': { name: '12P锁线', isSingle: false, imposeType: 'Imposition' },
    '16': { name: '16P锁线', isSingle: false, imposeType: 'Imposition' },
    '20': { name: '20P锁线', isSingle: false, imposeType: 'Imposition' },
    '24': { name: '24P锁线', isSingle: false, imposeType: 'Imposition' },
    '28': { name: '28P锁线', isSingle: false, imposeType: 'Imposition' },
    '32': { name: '32P锁线', isSingle: false, imposeType: 'Imposition' },
    '36': { name: '36P锁线', isSingle: false, imposeType: 'Imposition' }
  },

  // 边距和间距配置 (新增)
  LAYOUT_PARAMS: {
    '基础': { minGap: 6, maxGap: 12, minMargin: 5 },
    '安全': { minGap: 4, maxGap: 12, minMargin: 3 },
    '极限': { minGap: 3, maxGap: 12, minMargin: 2 }
  },

  // 高级配置
  QUEUE_PROCESS_DELAY: 1000,    // 队列处理延迟(毫秒)
  COMMAND_TIMEOUT: 120000,      // 命令执行超时(毫秒)
  FILE_STABILITY_THRESHOLD: 5000, // 文件稳定性检测阈值
  MAX_CONCURRENT_PROCESSES: 1   // 最大并发处理数
};