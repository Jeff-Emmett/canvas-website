import {
	DefaultToolbar,
	DefaultToolbarContent,
	TLComponents,
	TLUiOverrides,
	TldrawUiMenuItem,
	useIsToolSelected,
	useTools,
} from 'tldraw'

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
		return tools
	},
}

export const components: TLComponents = {
	Toolbar: (props) => {
		const tools = useTools()
		const isChatBoxSelected = useIsToolSelected(tools['ChatBox'])
		const isVideoSelected = useIsToolSelected(tools['VideoChat'])
		return (
			<DefaultToolbar {...props}>
				<TldrawUiMenuItem {...tools['VideoChat']} isSelected={isVideoSelected} />
				<TldrawUiMenuItem {...tools['ChatBox']} isSelected={isChatBoxSelected} />
				<DefaultToolbarContent />
			</DefaultToolbar>
		)
	},
}