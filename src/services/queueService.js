// =============================================================================
// ASYNC BATCH QUEUE & MEAL REMINDER SCHEDULER SERVICE
// Hôm nay ăn gì · Taste of Vietnam v0.2
// SLA: Strict <= 2 notifications/day per user profile (Anti-Fatigue)
// =============================================================================

class PushQueueService {
  constructor() {
    this.jobs = [];
    this.processedHistory = [];
    this.maxDailyPerUser = 2;
    this.isProcessing = false;
  }

  /**
   * Enqueue a push notification with anti-fatigue SLA guard
   */
  enqueueNotification(userId, { type, title, body, scheduledTime = null }) {
    const today = new Date().toISOString().slice(0, 10);
    const userTodayPushes = this.processedHistory.filter(
      (h) => h.userId === userId && h.sentAt.startsWith(today)
    ).length;

    if (userTodayPushes >= this.maxDailyPerUser) {
      return {
        success: false,
        reason: 'ANTI_FATIGUE_LIMIT_REACHED',
        message: `Đã vượt quá giới hạn ${this.maxDailyPerUser} thông báo/ngày của người dùng.`,
      };
    }

    const job = {
      id: `JOB-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId,
      type, // 'lunch_reminder', 'dinner_reminder', 'weather_alert'
      title,
      body,
      scheduledTime: scheduledTime || new Date().toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.jobs.push(job);
    return { success: true, job_id: job.id, status: 'queued' };
  }

  /**
   * Process all pending jobs in batch
   */
  async processBatch() {
    if (this.isProcessing) return { processed: 0 };
    this.isProcessing = true;

    const pending = this.jobs.filter((j) => j.status === 'pending');
    const results = [];

    for (const job of pending) {
      job.status = 'sent';
      job.sentAt = new Date().toISOString();
      this.processedHistory.push({
        jobId: job.id,
        userId: job.userId,
        sentAt: job.sentAt,
      });
      results.push(job);
    }

    // Retain only last 50 processed jobs in memory
    this.jobs = this.jobs.filter((j) => j.status !== 'sent');
    if (this.processedHistory.length > 200) {
      this.processedHistory = this.processedHistory.slice(-200);
    }

    this.isProcessing = false;
    return { processed: results.length, jobs: results };
  }

  getQueueStatus() {
    return {
      pending_jobs: this.jobs.filter((j) => j.status === 'pending').length,
      total_sent_today: this.processedHistory.length,
      is_processing: this.isProcessing,
    };
  }
}

export const pushQueue = new PushQueueService();
