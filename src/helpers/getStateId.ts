type StateType = 'status' | 'location' | 'sessionTime' | 'totalTime' | string

const getStateId = (stateType: StateType) => {
  switch (stateType) {
    case 'status':
      return 'cmi.completion_status'
    case 'location':
      return 'cmi.location'
    default:
      return `cmi.${stateType.replace(/([A-Z])/g, '_$1').toLowerCase()}`
  }
}

export default getStateId
