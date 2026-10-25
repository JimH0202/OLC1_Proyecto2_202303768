import { useState } from 'react'
import { checkBackendHealth, executeProgram } from '../services/api-client.js'

const initialSource = `server web {
    cpu = 2;
    memory = 4;
    disk = 50;
    os = "ubuntu";
}

main {
    start(web);
    print("AutoInfra listo");
}`

const newFileSource = `main {

}`

export function useWorkspaceController() {
  const [source, setSource] = useState(initialSource)
  const [fileName, setFileName] = useState('demostracion.infra')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [connectionChecking, setConnectionChecking] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('unknown')
  const [message, setMessage] = useState('')

  function updateSource(value) {
    setSource(value)
    setResult(null)
    setMessage('')
  }

  function createFile() {
    setSource(newFileSource)
    setFileName('sin-titulo.infra')
    setResult(null)
    setMessage('')
  }

  async function openFile(file) {
    if (!file) {
      return
    }

    setResult(null)
    setMessage('')
    try {
      updateSource(await file.text())
      setFileName(file.name.endsWith('.infra') ? file.name : `${file.name}.infra`)
      setMessage(`Archivo abierto: ${file.name}`)
    } catch (error) {
      setMessage(error instanceof Error
        ? `No se pudo abrir el archivo: ${error.message}`
        : 'No se pudo abrir el archivo.')
    }
  }

  function saveFileAs(name) {
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = name.endsWith('.infra') ? name : `${name}.infra`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    setMessage(`Archivo guardado: ${link.download}`)
  }

  function saveFile() {
    saveFileAs(fileName)
  }

  function saveFileAsPrompt() {
    const name = window.prompt('Nombre del archivo .infra', fileName)
    if (name?.trim()) {
      saveFileAs(name.trim())
      setFileName(name.trim().endsWith('.infra') ? name.trim() : `${name.trim()}.infra`)
    }
  }

  function clearExecution() {
    setResult(null)
    setMessage('')
  }

  async function validateConnection() {
    setConnectionChecking(true)
    setConnectionStatus('checking')
    setMessage('')

    try {
      await checkBackendHealth()
      setConnectionStatus('connected')
      setMessage('Conexión con el backend validada correctamente.')
    } catch (error) {
      setConnectionStatus('disconnected')
      setMessage(error instanceof Error
        ? `No se pudo conectar con el backend: ${error.message}`
        : 'No se pudo conectar con el backend.')
    } finally {
      setConnectionChecking(false)
    }
  }

  async function runProgram() {
    setLoading(true)
    setResult(null)
    setMessage('')

    try {
      setResult(await executeProgram(source))
    } catch (error) {
      setMessage(error instanceof Error
        ? `No se pudo ejecutar el programa: ${error.message}`
        : 'No se pudo ejecutar el programa.')
    } finally {
      setLoading(false)
    }
  }

  return {
    source,
    fileName,
    result,
    loading,
    connectionChecking,
    connectionStatus,
    message,
    updateSource,
    createFile,
    openFile,
    saveFile,
    saveFileAs: saveFileAsPrompt,
    clearExecution,
    validateConnection,
    runProgram,
  }
}
