import type { Activity, Agent, Statement, TinCanLaunchData } from '@xapi/xapi'
import XAPI from '@xapi/xapi'
import getStateId from './helpers/getStateId'

type Status = 'completed' | 'incomplete' | 'not attempted' | 'unknown'

interface Response<T = any> {
  data: T
  status: number
  statusText: string
}

class Api {
  debug: boolean
  launchData: Required<TinCanLaunchData> & { actor: Agent }
  sessionTime: number
  xapi: XAPI

  constructor(debug: Api['debug']) {
    this.debug = debug
    this.print('debug', this.debug)

    this.launchData = XAPI.getTinCanLaunchData() as Api['launchData']
    this.print('launchData', this.launchData)

    this.xapi = new XAPI(this.launchData.endpoint ?? '', this.launchData.auth)
    this.print('xapi', this.xapi)

    this.sessionTime = 0
  }

  static getStateId = getStateId

  private startTime = Date.now()

  private print(...rest: any[]) {
    if (this.debug) {
      console.log(...rest)
    }
  }

  private getPrams() {
    const params: [Agent, string] = [
      this.launchData.actor,
      this.launchData.activity_id,
    ]

    return params
  }

  private async request<T>(req: () => T) {
    if (this.launchData.endpoint === undefined) return

    try {
      const res = await req()
      this.print(res)

      return res
    } catch (err) {
      this.print(err)
    }
  }

  async sendStatement(value: Partial<Statement> & Pick<Statement, 'verb'>) {
    this.print('sendStatement', value)

    const state = {
      actor: this.launchData.actor,
      object: {
        objectType: 'Activity',
        id: this.launchData.activity_id ?? '',
      } as Activity,
      ...value,
    }
    const res = await this.request(() => this.xapi.sendStatement(state))

    return res
  }

  async getState<T = any>(id: string, registration?: string) {
    this.print('getState', id)

    const res = await this.request(() =>
      this.xapi.getState(...this.getPrams(), id, registration)
    )

    return res as Response<T>
  }

  async setState(
    stateId: string,
    state: Record<string, any> | unknown,
    registration?: string,
    etag?: string,
    matchHeader?: 'If-Match' | 'If-None-Match',
    contentType?: string
  ) {
    this.print('setState', stateId, state)

    const res = await this.request(() => {
      return this.xapi.setState(
        ...this.getPrams(),
        stateId,
        state,
        registration,
        etag,
        matchHeader,
        contentType
      )
    })

    return res
  }

  async getStatus(registration?: string) {
    this.print('getStatus')

    const res = await this.request(() => {
      return this.xapi.getState(
        ...this.getPrams(),
        getStateId('status'),
        registration
      )
    })

    return res as Response<Status>
  }

  async setStatus(
    state: Status,
    registration?: string,
    etag?: string,
    matchHeader?: 'If-Match' | 'If-None-Match',
    contentType?: string
  ) {
    this.print('setStatus', state)

    const res = await this.request(() => {
      return this.xapi.setState(
        ...this.getPrams(),
        getStateId('status'),
        state,
        registration,
        etag,
        matchHeader,
        contentType
      )
    })

    return res
  }

  async initialize() {
    this.print('initialize')

    const res = await this.sendStatement({
      verb: XAPI.Verbs.INITIALIZED,
    })

    const statusData = await this.getStatus()
    if (statusData?.data !== 'completed') await this.setStatus('incomplete')

    return res
  }

  async terminate() {
    this.print('terminate')

    const sessionTime = Date.now() - this.startTime

    await this.setState(getStateId('sessionTime'), sessionTime)

    const lastTotalTime =
      (await this.getState(getStateId('totalTime')))?.data ?? 0
    const newTotalTime = lastTotalTime + sessionTime

    await this.setState(getStateId('totalTime'), newTotalTime)

    const res = await this.sendStatement({
      verb: XAPI.Verbs.TERMINATED,
    })

    return res
  }
}

export default Api
