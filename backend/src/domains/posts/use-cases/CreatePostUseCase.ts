import { inject, injectable } from 'tsyringe'
import type { PrismaClient } from '@prisma/client'
import { PRISMA_CLIENT } from '../../../infra/tokens.js'
import { POST_REPOSITORY, type IPostRepository } from '../core/ports/IPostRepository.js'
import type { Post } from '../core/entities/Post.js'

@injectable()
export class CreatePostUseCase {
  constructor(
    @inject(POST_REPOSITORY) private readonly repo: IPostRepository,
    @inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async execute(input: { title: string; description: string }): Promise<Post> {
    const post = await this.repo.create(input)

    await this.prisma.outboxEvent.create({
      data: {
        type: 'PostCreated',
        payload: {
          id: post.id,
          title: post.title,
          description: post.description,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
        },
      },
    })

    return post
  }
}
