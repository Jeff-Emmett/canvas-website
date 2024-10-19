import {
	DefaultToolbar,
	DefaultToolbarContent,
	TLComponents,
	TLUiOverrides,
	TldrawUiMenuItem,
	useIsToolSelected,
	useTools,
} from 'tldraw'
import { CustomMainMenu } from './components/CustomMainMenu'
import { EmbedShape } from './shapes/EmbedShapeUtil'

export const uiOverrides: TLUiOverrides = {
	tools(editor, tools) {
		tools.VideoChat = {
			id: 'VideoChat',
			icon: 'color',
			label: 'Video',
			kbd: 'x',
			onSelect: () => {
				editor.setCurrentTool('VideoChat')
			},
		}
		tools.ChatBox = {
			id: 'ChatBox',
			icon: 'color',
			label: 'Chat',
			kbd: 'x',
			onSelect: () => {
				editor.setCurrentTool('ChatBox')
			},
		}
		tools.Embed = {
			id: 'Embed',
			icon: 'embed',
			label: 'Embed',
			kbd: 'e',
			onSelect: () => {
				editor.setCurrentTool('Embed')
			},
		}
		return tools
	},
}

export const components: TLComponents = {
	Toolbar: (props) => {
		const tools = useTools()
		const isChatBoxSelected = useIsToolSelected(tools['ChatBox'])
		const isVideoSelected = useIsToolSelected(tools['VideoChat'])
		const isEmbedSelected = useIsToolSelected(tools['Embed'])
		return (
			<DefaultToolbar {...props}>
				<TldrawUiMenuItem {...tools['VideoChat']} isSelected={isVideoSelected} />
				<TldrawUiMenuItem {...tools['ChatBox']} isSelected={isChatBoxSelected} />
				<TldrawUiMenuItem {...tools['Embed']} isSelected={isEmbedSelected} />
				<DefaultToolbarContent />
			</DefaultToolbar>
		)
	},
	MainMenu: CustomMainMenu,
}