from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class MCPToolSchema(BaseModel):
    name: str
    description: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = Field(None, alias="inputSchema")
    output_schema: Optional[Dict[str, Any]] = Field(None, alias="outputSchema")
    # Add other fields like 'annotations' if needed later
    class Config:
        populate_by_name = True # Allows using inputSchema as field name during instantiation

class MCPResourceSchema(BaseModel): # Placeholder, we don't have resources yet
    name: str
    description: Optional[str] = None
    # Add other fields if needed

class MCPServerInfo(BaseModel):
    name: str
    instructions: Optional[str] = None
    version: Optional[str] = "0.1.0" # Example version

class MCPContext(BaseModel):
    server: MCPServerInfo
    tools: List[MCPToolSchema] = Field(default_factory=list)
    resources: List[MCPResourceSchema] = Field(default_factory=list) # Placeholder
    # Add other top-level fields like 'prompts' if needed
