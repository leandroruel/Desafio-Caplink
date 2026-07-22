import amqp, { type ChannelModel } from 'amqplib'
import { pubsub } from '../../../infra/pubsub.js'
import { Post } from '../core/entities/Post.js'
import { resolveEventTopic, type PostEventType } from './resolveEventTopic.js'
import { getPostEventsQueueOptions } from './getPostEventsQueueOptions.js'

const EXCHANGE = 'posts.events'

type PostEventMessage = {
  type: PostEventType
  post: {
    id: string
    title: string
    description: string
    createdAt: string
    updatedAt: string
  }
}

export async function startPostEventsConsumer(amqpUrl: string): Promise<void> {
  let connection: ChannelModel | undefined
  let connecting: Promise<void> | undefined

  const connect = async (): Promise<void> => {
    if (connecting) return connecting

    connecting = (async () => {
      try {
        if (connection) {
          const old = connection
          connection = undefined
          await old.close().catch(() => {})
        }

        connection = await amqp.connect(amqpUrl)
        const channel = await connection.createChannel()
        await channel.assertExchange(EXCHANGE, 'fanout', { durable: true })

        const { name, ...queueOptions } = getPostEventsQueueOptions()
        const { queue } = await channel.assertQueue(name, queueOptions)
        await channel.bindQueue(queue, EXCHANGE, '')

        channel.consume(queue, (msg) => {
          if (!msg) return
          const event = JSON.parse(msg.content.toString()) as PostEventMessage
          const post = new Post({
            id: event.post.id,
            title: event.post.title,
            description: event.post.description,
            createdAt: new Date(event.post.createdAt),
            updatedAt: new Date(event.post.updatedAt),
          })
          pubsub.publish(resolveEventTopic(event.type), { post })
          channel.ack(msg)
        })

        connection.on('close', () => {
          connection = undefined
          setTimeout(() => { connecting = undefined; connect() }, 1_000)
        })
        connection.on('error', () => {
          connection = undefined
        })
      } catch {
        connecting = undefined
        setTimeout(connect, 2_000)
      }
    })()

    return connecting
  }

  await connect()
}
