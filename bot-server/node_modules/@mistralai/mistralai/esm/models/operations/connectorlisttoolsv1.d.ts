import * as z from "zod/v4";
import { Result as SafeParseResult } from "../../types/fp.js";
import * as components from "../components/index.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
export type ConnectorListToolsV1Request = {
    page?: number | undefined;
    pageSize?: number | undefined;
    refresh?: boolean | undefined;
    /**
     * Return a simplified payload with only name, description, annotations, and a compact inputSchema.
     */
    pretty?: boolean | undefined;
    connectorIdOrName: string;
};
export type ResponseConnectorListToolsV11 = components.ConnectorTool | components.MCPTool;
/**
 * Successful Response
 */
export type ResponseConnectorListToolsV12 = Array<components.ConnectorTool | components.MCPTool> | Array<{
    [k: string]: any;
}>;
/** @internal */
export type ConnectorListToolsV1Request$Outbound = {
    page: number;
    page_size: number;
    refresh: boolean;
    pretty: boolean;
    connector_id_or_name: string;
};
/** @internal */
export declare const ConnectorListToolsV1Request$outboundSchema: z.ZodType<ConnectorListToolsV1Request$Outbound, ConnectorListToolsV1Request>;
export declare function connectorListToolsV1RequestToJSON(connectorListToolsV1Request: ConnectorListToolsV1Request): string;
/** @internal */
export declare const ResponseConnectorListToolsV11$inboundSchema: z.ZodType<ResponseConnectorListToolsV11, unknown>;
export declare function responseConnectorListToolsV11FromJSON(jsonString: string): SafeParseResult<ResponseConnectorListToolsV11, SDKValidationError>;
/** @internal */
export declare const ResponseConnectorListToolsV12$inboundSchema: z.ZodType<ResponseConnectorListToolsV12, unknown>;
export declare function responseConnectorListToolsV12FromJSON(jsonString: string): SafeParseResult<ResponseConnectorListToolsV12, SDKValidationError>;
//# sourceMappingURL=connectorlisttoolsv1.d.ts.map