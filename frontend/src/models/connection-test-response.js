export class ConnectionTestResponse {
  constructor({ httpStatus, ...data }) {
    this.httpStatus = httpStatus
    Object.assign(this, data)
  }

  static fromError(error) {
    return new ConnectionTestResponse({
      success: false,
      message: error instanceof Error
        ? error.message
        : 'No se pudo contactar el backend.',
    })
  }
}
