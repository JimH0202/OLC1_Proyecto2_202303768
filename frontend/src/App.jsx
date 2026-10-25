import { useConnectionTestController } from './controllers/useConnectionTestController.js'
import { ConnectionTestView } from './views/ConnectionTestView.jsx'

function App() {
  const controller = useConnectionTestController()

  return (
    <ConnectionTestView
      source={controller.source}
      onSourceChange={controller.setSource}
      result={controller.result}
      loading={controller.loading}
      onTestConnection={controller.testConnection}
    />
  )
}

export default App
