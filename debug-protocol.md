# Data transfer protocol for the debug connection of Tabris.js

```
interface ClientMessage {
    sessionId: string;
    type: 'log' | 'connect' | 'action-response' | 'storage';
    parameter: LogParameter | ConnectParameter | ActionResponseParameter | StorageParameter;
};

interface LogParameter {
    level: 'debug' | 'log' | 'info' | 'warn' | 'error';
    message: string;
};

interface ConnectParameter {
    platform: string;
    model: string;
}

interface ActionResponseParameter {
    enablePrompt: boolean;
}

interface StorageParameter {
    platform: 'ios' | 'android';
    localStorage: object;
    secureStorage: object;
}
```
