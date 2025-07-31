// queueManager.js
const impositionService = require('./impositionService');
const config = require('./config');

// 任务队列
const processingQueue = [];
let isProcessing = false;

function addToQueue(task) {
  processingQueue.push(task);
  console.log(`📊 任务队列长度: ${processingQueue.length}`);
  
  if (!isProcessing) {
    processQueue();
  }
}

async function processQueue() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }
  
  isProcessing = true;
  const task = processingQueue.shift();
  
  try {
    await impositionService.processTask(task);
  } catch (error) {
    console.error('❌ 任务处理失败:', error);
  } finally {
    // 延迟处理下一个任务
    setTimeout(() => processQueue(), config.QUEUE_PROCESS_DELAY);
  }
}

module.exports = {
  addToQueue
};