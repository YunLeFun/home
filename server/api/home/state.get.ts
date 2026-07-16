import { requireCloudBaseUser } from '../../utils/cloudbase-auth'
import { loadHomeState } from '../../utils/home-state'

export default defineEventHandler(async (event) => {
  const user = await requireCloudBaseUser(event)
  return await loadHomeState(user.id)
})
