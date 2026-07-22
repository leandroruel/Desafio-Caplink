import { describe, expect, it, vi } from 'vitest'
import { CreatePostUseCase } from './CreatePostUseCase.js'
import { MockPostRepository } from '../mocks/MockPostRepository.js'

describe('CreatePostUseCase', () => {
  it('creates and persists a post, and writes a PostCreated outbox event', async () => {
    const repo = new MockPostRepository()
    const outboxCreate = vi.fn()
    const prisma = { outboxEvent: { create: outboxCreate } } as any
    const useCase = new CreatePostUseCase(repo, prisma)

    const post = await useCase.execute({ title: 'Hello', description: 'World' })

    expect(post.title).toBe('Hello')
    expect(post.description).toBe('World')
    expect(await repo.findById(post.id)).not.toBeNull()

    expect(outboxCreate).toHaveBeenCalledTimes(1)
    expect(outboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PostCreated',
        payload: expect.objectContaining({ id: post.id, title: 'Hello' }),
      }),
    })
  })
})
