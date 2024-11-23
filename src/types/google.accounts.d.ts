declare namespace google {
    namespace accounts {
        namespace oauth2 {
            interface TokenClient {
                callback: (response: { access_token?: string }) => void;
                client_id: string;
                scope: string;
            }

            function initTokenClient(config: {
                client_id: string;
                scope: string;
                callback: (response: { access_token?: string }) => void;
                error_callback?: (error: any) => void;
            }): {
                requestAccessToken(options?: { prompt?: string }): void;
            };
        }
    }

    namespace picker {
        class PickerBuilder {
            addView(view: any): PickerBuilder;
            setOAuthToken(token: string): PickerBuilder;
            setDeveloperKey(key: string): PickerBuilder;
            setCallback(callback: (data: PickerResponse) => void): PickerBuilder;
            build(): Picker;
        }

        interface PickerResponse {
            action: string;
            docs: Array<{
                id: string;
                name: string;
                url: string;
                mimeType: string;
            }>;
        }

        class Picker {
            setVisible(visible: boolean): void;
        }

        const ViewId: {
            DOCS: string;
            DOCUMENTS: string;
            PRESENTATIONS: string;
            SPREADSHEETS: string;
            FOLDERS: string;
        };
    }
}