import { AppDataSource } from "../config/database.config"
import { Review } from "../models/review.entity"

export class ReviewService {
  private reviewRepository = AppDataSource.getRepository(Review)

  async getProductReviews(productId: string) {
    return this.reviewRepository.find({
      where: { productId },
      relations: ["user"],
      order: { createdAt: "DESC" }
    })
  }

  async addReview(userId: string, productId: string, rating: number, comment: string) {
    const review = this.reviewRepository.create({
      userId,
      productId,
      rating,
      comment
    })
    return this.reviewRepository.save(review)
  }
}
