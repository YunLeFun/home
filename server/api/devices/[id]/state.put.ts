import { requireCloudBaseUser } from '../../../utils/cloudbase-auth'
import { parseDeviceStateChange, saveDeviceState } from '../../../utils/device-state'

export default defineEventHandler(async (event) => {
  const deviceId = getRouterParam(event, 'id')
  if (!deviceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing device id',
    })
  }

  const user = await requireCloudBaseUser(event)
  const body = await readBody<unknown>(event)
  const change = parseDeviceStateChange(body, deviceId)

  return await saveDeviceState(user.id, change)
})
