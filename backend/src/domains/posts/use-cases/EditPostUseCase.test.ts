import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EditPostUseCase } from './EditPostUseCase.js'
import { MockPostRepository } from '../mocks/MockPostRepository.js'
import { PostNotFoundError } from '../core/errors/PostNotFoundError.js'
import type { Post } from '../core/entities/Post.js'

describe('EditPostUseCase', () => {
  let repo: MockPostRepository
  let outboxCreate: ReturnType<typeof vi.fn>
  let useCase: EditPostUseCase
  let existing: Post

  beforeEach(async () => {
    repo = new MockPostRepository()
    outboxCreate = vi.fn()
    const prisma = { outboxEvent: { create: outboxCreate } } as any
    useCase = new EditPostUseCase(repo, prisma)
    existing = await repo.create({ title: 'Old', description: 'Old body' })
  })

  it('persists the edit and writes a PostEdited outbox event', async () => {
    const result = await useCase.execute({
      id: existing.id,
      title: 'New',
      description: 'New body',
    })

    expect(result.title).toBe('New')
    expect((await repo.findById(existing.id))?.description).toBe('New body')

    expect(outboxCreate).toHaveBeenCalledTimes(1)
    expect(outboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PostEdited',
        payload: expect.objectContaining({ id: existing.id, title: 'New' }),
      }),
    })
  })

  it('throws PostNotFoundError for an unknown id', async () => {
    await expect(
      useCase.execute({ id: 'missing', title: 'x', description: 'y' }),
    ).rejects.toBeInstanceOf(PostNotFoundError)
  })

  it('persists the update before writing the outbox event', async () => {
    const callOrder: string[] = []

    const originalUpdate = repo.update.bind(repo)
    vi.spyOn(repo, 'update').mockImplementation(async (post) => {
      const result = await originalUpdate(post)
      callOrder.push('update')
      return result
    })

    outboxCreate.mockImplementation(async () => {
      callOrder.push('outbox')
    })

    await useCase.execute({ id: existing.id, title: 'New', description: 'New body' })

    expect(callOrder).toEqual(['update', 'outbox'])
  })
})
