import { useWorkspaceController } from './controllers/useWorkspaceController.js'
import { WorkspaceView } from './views/WorkspaceView.jsx'

function App() {
  const controller = useWorkspaceController()

  return (
    <WorkspaceView
      source={controller.source}
      fileName={controller.fileName}
      result={controller.result}
      loading={controller.loading}
      message={controller.message}
      onSourceChange={controller.updateSource}
      onNew={controller.createFile}
      onOpen={controller.openFile}
      onSave={controller.saveFile}
      onRunProgram={controller.runProgram}
    />
  )
}

export default App
