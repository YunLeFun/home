import { requireCloudBaseUser } from '../../utils/cloudbase-auth'
import { parseHomeState, saveHomeState } from '../../utils/home-state'

export default defineEventHandler(async (event) => {
  const user = await requireCloudBaseUser(event)
  const state = parseHomeState(await readBody<unknown>(event))
  return await saveHomeState(user.id, state)
})
