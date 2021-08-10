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

  async sendStatement(value: Partial<Statement> & Pick<Statement, 'verb'>) {
    try {
      const state = {
        actor: this.launchData.actor,
        object: {
          objectType: 'Activity',
          id: this.launchData.activity_id ?? '',
        } as Activity,
        ...value,
      }
      const res = await this.xapi.sendStatement(state)
      this.print('sendStatement', value, res)

      return res
    } catch (err) {
      this.print('sendStatement', err)
    }
  }

  async getState<T = any>(id: string, registration?: string) {
    try {
      const res = await this.xapi.getState(...this.getPrams(), id, registration)
      this.print('getState', id, res)

      return res as Response<T>
    } catch (err) {
      this.print('getState', err)
    }
  }

  async setState(
    stateId: string,
    state: Record<string, any> | unknown,
    registration?: string,
    etag?: string,
    matchHeader?: 'If-Match' | 'If-None-Match',
    contentType?: string
  ) {
    try {
      const res = await this.xapi.setState(
        ...this.getPrams(),
        stateId,
        state,
        registration,
        etag,
        matchHeader,
        contentType
      )
      this.print('setState', stateId, state, res)

      return res
    } catch (err) {
      this.print('setState', err)
    }
  }

  async getStatus(registration?: string) {
    try {
      const res = await this.xapi.getState(
        ...this.getPrams(),
        getStateId('status'),
        registration
      )
      this.print('getStatus', res)

      return res as Response<Status>
    } catch (err) {
      this.print('getStatus', err)
    }
  }

  async setStatus(
    state: Status,
    registration?: string,
    etag?: string,
    matchHeader?: 'If-Match' | 'If-None-Match',
    contentType?: string
  ) {
    try {
      const res = await this.xapi.setState(
        ...this.getPrams(),
        getStateId('status'),
        state,
        registration,
        etag,
        matchHeader,
        contentType
      )
      this.print('setStatus', state, res)

      return res
    } catch (err) {
      this.print('setStatus', err)
    }
  }

  async initialize() {
    try {
      const res = await this.sendStatement({
        verb: XAPI.Verbs.INITIALIZED,
      })
      this.print('initialize', res)

      const statusData = await this.getStatus()
      if (statusData?.data !== 'completed') await this.setStatus('incomplete')

      return res
    } catch (err) {
      this.print('initialize', err)
    }
  }

  async terminate() {
    try {
      const sessionTime = Date.now() - this.startTime

      await this.setState(getStateId('sessionTime'), sessionTime)

      const lastTotalTime =
        (await this.getState(getStateId('totalTime')))?.data ?? 0
      const newTotalTime = lastTotalTime + sessionTime

      await this.setState(getStateId('totalTime'), newTotalTime)

      const res = await this.sendStatement({
        verb: XAPI.Verbs.TERMINATED,
      })
      this.print('terminate', res)

      return res
    } catch (err) {
      this.print('terminate', err)
    }
  }
}

export default Api
