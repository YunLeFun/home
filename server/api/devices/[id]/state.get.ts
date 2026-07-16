import { requireCloudBaseUser } from '../../../utils/cloudbase-auth'
import { loadDeviceState } from '../../../utils/device-state'

export default defineEventHandler(async (event) => {
  const deviceId = getRouterParam(event, 'id')
  if (!deviceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing device id',
    })
  }

  const user = await requireCloudBaseUser(event)
  return await loadDeviceState(user.id, deviceId)
})
