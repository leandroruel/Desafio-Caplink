import { inject, injectable } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../../../infra/tokens.js'
import { POST_REPOSITORY, type IPostRepository } from '../core/ports/IPostRepository.js'
import { PostNotFoundError } from '../core/errors/PostNotFoundError.js'
import type { Post } from '../core/entities/Post.js'

@injectable()
export class EditPostUseCase {
  constructor(
    @inject(POST_REPOSITORY) private readonly repo: IPostRepository,
    @inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async execute(input: { id: string; title: string; description: string }): Promise<Post> {
    const post = await this.repo.findById(input.id)
    if (!post) throw new PostNotFoundError(input.id)

    post.edit(input.title, input.description)

    const updated = await this.repo.update(post)

    await this.prisma.outboxEvent.create({
      data: {
        type: 'PostEdited',
        payload: {
          id: updated.id,
          title: updated.title,
          description: updated.description,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
    })

    return updated
  }
}
