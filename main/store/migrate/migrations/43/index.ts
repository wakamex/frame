const migrate = (initial: any) => {
  try {
    if (!initial.main.addressBook) {
      initial.main.addressBook = {}
    }
    return initial
  } catch (e) {
    return initial
  }
}

export default { version: 43, migrate }
