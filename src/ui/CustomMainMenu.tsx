import {
    DefaultMainMenu,
    TldrawUiMenuItem,
    Editor,
    TLContent,
    DefaultMainMenuContent,
    useEditor,
    useExportAs,
    TldrawUiMenuSubmenu,
} from "tldraw";
import { useState, useEffect } from 'react';

interface BackupVersion {
    key: string;
    timestamp: string;
}

export function CustomMainMenu() {
    const editor = useEditor()
    const exportAs = useExportAs()
    const [backupVersions, setBackupVersions] = useState<BackupVersion[]>([])

    useEffect(() => {
        const fetchBackups = async (roomId: string) => {
            try {
                const response = await fetch(`/backups/${roomId}`);
                const versions = await response.json() as BackupVersion[];
                setBackupVersions(versions);
            } catch (error) {
                console.error('Failed to fetch backup versions:', error);
            }
        };
        fetchBackups([roomId]);
    }, []);

    const restoreVersion = async (key: string) => {
        try {
            const response = await fetch(`/backups/${key}`);
            const jsonData = await response.json() as TLContent;
            editor.putContentOntoCurrentPage(jsonData, { select: true });
        } catch (error) {
            console.error('Failed to restore version:', error);
        }
    };

    const importJSON = (editor: Editor) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                if (typeof event.target?.result !== 'string') {
                    return
                }
                const jsonData = JSON.parse(event.target.result) as TLContent
                editor.putContentOntoCurrentPage(jsonData, { select: true })
            };
            if (file) {
                reader.readAsText(file);
            }
        };
        input.click();
    };
    const exportJSON = (editor: Editor) => {
        const exportName = `props-${Math.round(+new Date() / 1000).toString().slice(5)}`
        exportAs(Array.from(editor.getCurrentPageShapeIds()), 'json', exportName)
    };

    return (
        <DefaultMainMenu>
            <DefaultMainMenuContent />
            <TldrawUiMenuSubmenu id="restore-version" label="Restore Version">
                {backupVersions.map((version) => (
                    <TldrawUiMenuItem
                        key={version.key}
                        id={`restore-${version.key}`}
                        label={version.timestamp}
                        onSelect={() => restoreVersion(version.key)}
                    />
                ))}
            </TldrawUiMenuSubmenu>
            <TldrawUiMenuItem
                id="export"
                label="Export JSON"
                icon="external-link"
                readonlyOk
                onSelect={() => exportJSON(editor)}
            />
            <TldrawUiMenuItem
                id="import"
                label="Import JSON"
                icon="external-link"
                readonlyOk
                onSelect={() => importJSON(editor)}
            />
        </DefaultMainMenu>
    )
}