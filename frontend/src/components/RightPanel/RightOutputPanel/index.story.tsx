import RightOutputPanel from '.'
import type { ExecutionResponse } from '../../../utils'

export const Default = ({ resp = null }: { resp?: ExecutionResponse | null }) => (
  <RightOutputPanel resp={resp} />
)
