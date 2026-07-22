import { type PrismaClient } from '@prisma/client'
import { PostEventsProducer } from '../producers/PostEventsProducer.js'

export class OutboxPublisher {
  private running = false
  private timer?: NodeJS.Timeout

  constructor(
    private readonly prisma: PrismaClient,
    private readonly producer: PostEventsProducer,
  ) {}

  start(): void {
    this.running = true
    this.poll()
  }

  stop(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
  }

  private async poll(): Promise<void> {
    if (!this.running) return

    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { published: false },
        orderBy: { createdAt: 'asc' },
        take: 50,
      })

      for (const event of events) {
        try {
          if (event.type === 'PostCreated') {
            await this.producer.publishPostCreated(event.payload as any)
          } else if (event.type === 'PostEdited') {
            await this.producer.publishPostEdited(event.payload as any)
          }

          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { published: true },
          })
        } catch {
          break
        }
      }
    } catch {
      // log error
    }

    this.timer = setTimeout(() => this.poll(), 1_000)
  }
}
