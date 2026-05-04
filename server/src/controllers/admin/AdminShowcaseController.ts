import { Body, Delete, JsonController, NotFoundError, Param, Post, Put } from 'routing-controllers'
import { Service } from 'typedi'

import { Showcase } from '../../content/types'
import { ShowcaseModel } from '../../db/models/Showcase'
import logger from '../../utils/logger'

@JsonController('/admin/showcases')
@Service()
export class AdminShowcaseController {
  /**
   * Create a new showcase
   */
  @Post('/')
  public async createShowcase(@Body() body: Showcase) {
    logger.debug({ body }, 'Creating new showcase')
    try {
      const showcase = new ShowcaseModel(body)
      const saved = await showcase.save()
      logger.debug({ showcaseId: saved._id }, 'Showcase created successfully')
      return saved.toObject()
    } catch (error) {
      logger.error(error, 'Error creating showcase')
      throw error
    }
  }

  /**
   * Update a showcase by name
   */
  @Put('/:showcaseName')
  public async updateShowcase(@Param('showcaseName') showcaseName: string, @Body() body: Partial<Showcase>) {
    logger.debug({ showcaseName, body }, 'Updating showcase')
    try {
      const showcase = await ShowcaseModel.findOneAndUpdate({ name: showcaseName }, body, {
        new: true,
        runValidators: true,
      }).lean()

      if (!showcase) {
        logger.warn({ showcaseName }, 'Showcase not found for update')
        throw new NotFoundError(`Showcase with name "${showcaseName}" not found.`)
      }

      logger.debug({ showcaseName }, 'Showcase updated successfully')
      return showcase
    } catch (error) {
      logger.error(error, 'Error updating showcase')
      throw error
    }
  }

  /**
   * Delete a showcase by name
   */
  @Delete('/:showcaseName')
  public async deleteShowcase(@Param('showcaseName') showcaseName: string) {
    logger.debug({ showcaseName }, 'Deleting showcase')
    try {
      const result = await ShowcaseModel.findOneAndDelete({ name: showcaseName })

      if (!result) {
        logger.warn({ showcaseName }, 'Showcase not found for deletion')
        throw new NotFoundError(`Showcase with name "${showcaseName}" not found.`)
      }

      logger.debug({ showcaseName }, 'Showcase deleted successfully')
      return { message: 'Showcase deleted successfully' }
    } catch (error) {
      logger.error(error, 'Error deleting showcase')
      throw error
    }
  }
}
