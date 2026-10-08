import EventEmitter from 'events';

// In-memory queue storage
const queues = {};

class CustomQueue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.workers = [];
  }

  async add(name, data, options = {}) {
    let resolve, reject;
    const finished = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Prevent unhandled promise rejection crash if no one awaits the finished promise
    finished.catch(() => {});

    const job = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      data,
      options,
      attempts: 0,
      maxAttempts: options.attempts || 1,
      backoff: options.backoff || { type: 'exponential', delay: 5000 },
      status: 'waiting',
      created_at: new Date(),
      finished,
      resolve,
      reject
    };
    this.jobs.push(job);
    console.log(`[Queue:${this.name}] Added job ${job.id} (type: ${name}) for plant ID ${data.plantId}`);
    
    // Trigger workers
    this.triggerWorkers();
    return job;
  }

  triggerWorkers() {
    for (const worker of this.workers) {
      worker.processNext();
    }
  }
}

class CustomWorker extends EventEmitter {
  constructor(queueName, processor, options = {}) {
    super();
    this.queueName = queueName;
    this.processor = processor;
    this.concurrency = options.concurrency || 1;
    this.limiter = options.limiter || { max: 1, duration: 1000 };
    this.activeCount = 0;
    this.recentExecutions = [];

    // Auto-register queue
    if (!queues[queueName]) {
      queues[queueName] = new CustomQueue(queueName);
    }
    this.queue = queues[queueName];
    this.queue.workers.push(this);

    // Initial check
    setTimeout(() => this.processNext(), 100);
  }

  async processNext() {
    if (this.activeCount >= this.concurrency) return;

    // Apply rate limiter: filter executions within the time duration window
    const now = Date.now();
    this.recentExecutions = this.recentExecutions.filter(t => now - t < this.limiter.duration);
    if (this.recentExecutions.length >= this.limiter.max) {
      const oldestExec = this.recentExecutions[0];
      const waitTime = this.limiter.duration - (now - oldestExec);
      setTimeout(() => this.processNext(), waitTime);
      return;
    }

    // Find the first job that is waiting to be processed
    const job = this.queue.jobs.find(j => j.status === 'waiting');
    if (!job) return;

    job.status = 'active';
    this.activeCount++;
    this.recentExecutions.push(now);

    console.log(`[Worker:${this.queueName}] Starting job ${job.id} (Attempt ${job.attempts + 1}/${job.maxAttempts})`);

    try {
      const result = await this.processor(job);
      job.status = 'completed';
      console.log(`[Worker:${this.queueName}] Job ${job.id} completed successfully.`);
      
      job.resolve(result);

      if (job.options.removeOnComplete) {
        this.queue.jobs = this.queue.jobs.filter(j => j.id !== job.id);
      }
    } catch (error) {
      job.attempts++;
      console.error(`[Worker:${this.queueName}] Job ${job.id} error:`, error.message);

      if (job.attempts < job.maxAttempts) {
        job.status = 'delayed';
        const delayMs = job.backoff.type === 'exponential'
          ? job.backoff.delay * Math.pow(2, job.attempts - 1)
          : job.backoff.delay;

        console.log(`[Worker:${this.queueName}] Retrying job ${job.id} in ${delayMs}ms...`);
        setTimeout(() => {
          job.status = 'waiting';
          this.processNext();
        }, delayMs);
      } else {
        job.status = 'failed';
        job.reject(error);
        this.emit('failed', job, error);
        console.error(`[Worker:${this.queueName}] Job ${job.id} failed permanently after ${job.attempts} attempts.`);

        // Apply removeOnFail count limit
        const removeLimit = typeof job.options.removeOnFail === 'number' ? job.options.removeOnFail : 50;
        const failedJobs = this.queue.jobs.filter(j => j.status === 'failed');
        if (failedJobs.length > removeLimit) {
          const oldestFailed = failedJobs.slice(0, failedJobs.length - removeLimit);
          this.queue.jobs = this.queue.jobs.filter(j => !oldestFailed.includes(j));
        }
      }
    } finally {
      this.activeCount--;
      // Schedule next check
      setTimeout(() => this.processNext(), 0);
    }
  }
}

// Mimic BullMQ Queue registry
export function get(oemName) {
  const queueName = `${oemName}-scrapes`;
  if (!queues[queueName]) {
    queues[queueName] = new CustomQueue(queueName);
  }
  return queues[queueName];
}

export { CustomWorker as Worker };
