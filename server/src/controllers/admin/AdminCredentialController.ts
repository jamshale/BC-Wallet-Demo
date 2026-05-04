import { Body, Delete, JsonController, NotFoundError, Param, Post, Put } from 'routing-controllers'
import { Service } from 'typedi'

import { Credential } from '../../content/types'
import { CredentialModel } from '../../db/models/Credential'
import logger from '../../utils/logger'

@JsonController('/admin/credentials')
@Service()
export class AdminCredentialController {
  /**
   * Create a new credential
   */
  @Post('/')
  public async createCredential(@Body() body: Credential) {
    logger.debug({ body }, 'Creating new credential')
    try {
      const credential = new CredentialModel(body)
      const saved = await credential.save()
      logger.debug({ credentialId: saved._id }, 'Credential created successfully')
      const obj = saved.toObject() as any
      return {
        id: String(obj._id),
        name: obj.name,
        icon: obj.icon,
        version: obj.version,
        attributes: obj.attributes || [],
      }
    } catch (error) {
      logger.error(error, 'Error creating credential')
      throw error
    }
  }

  /**
   * Update a credential by id
   */
  @Put('/:credentialId')
  public async updateCredential(@Param('credentialId') credentialId: string, @Body() body: Partial<Credential>) {
    logger.debug({ credentialId, body }, 'Updating credential')
    try {
      const credential = await CredentialModel.findByIdAndUpdate(credentialId, body, {
        new: true,
        runValidators: true,
      }).lean()

      if (!credential) {
        logger.warn({ credentialId }, 'Credential not found for update')
        throw new NotFoundError(`Credential with id "${credentialId}" not found.`)
      }

      logger.debug({ credentialId }, 'Credential updated successfully')
      const cred = credential as any
      return {
        id: String(cred._id),
        name: cred.name,
        icon: cred.icon,
        version: cred.version,
        attributes: cred.attributes || [],
      }
    } catch (error) {
      logger.error(error, 'Error updating credential')
      throw error
    }
  }

  /**
   * Delete a credential by id
   */
  @Delete('/:credentialId')
  public async deleteCredential(@Param('credentialId') credentialId: string) {
    logger.debug({ credentialId }, 'Deleting credential')
    try {
      const result = await CredentialModel.findByIdAndDelete(credentialId)

      if (!result) {
        logger.warn({ credentialId }, 'Credential not found for deletion')
        throw new NotFoundError(`Credential with id "${credentialId}" not found.`)
      }

      logger.debug({ credentialId }, 'Credential deleted successfully')
      return { message: 'Credential deleted successfully' }
    } catch (error) {
      logger.error(error, 'Error deleting credential')
      throw error
    }
  }
}
