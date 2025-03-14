import json
from litellm import completion, acompletion
import re
from typing import List, Optional, Dict
from prompts import reflect_system_prompt
import os

class ReflectionSearch:
    def __init__(self, model: str):
        """Initialize reflection search with a specific LLM model"""
        self.model = model
        self.messages: List[Dict[str, str]] = []
        
    def sanitize_json_text(self, text: str) -> str:
        """Sanitize text by removing only the markdown code block delimiters while preserving content"""
        # Remove opening ```json delimiter
        text = re.sub(r'```json\s*', '', text)
        # Remove opening ``` delimiter (for any other language or no language specified)
        text = re.sub(r'```\s*', '', text)
        # Remove closing ``` delimiter
        text = re.sub(r'\s*```', '', text)
        return text.strip()
        
    async def send(self, message: str, role: str = "user"):
        """Send a message to the LLM and stream the response"""
        self.messages.append({
            "role": role,
            "content": message
        })
        
        try:
            response = await acompletion(
                model=self.model,
                messages=self.messages,
                stream=True,
            )
            
            accumulated_reflection = ""
            thinking_buffer = ""
            in_thinking_section = False
            
            # Function to check if buffer should be flushed
            def should_flush_buffer(buffer):
                # Count words in buffer
                word_count = len(buffer.split())
                return word_count >= 10
            
            # Function to flush buffer and reset it
            def flush_buffer():
                nonlocal thinking_buffer
                if thinking_buffer.strip():
                    result = thinking_buffer
                    thinking_buffer = ""
                    return result
                return None
            
            total_text = ""
            # Handle streaming response correctly
            async for chunk in response:
                if not hasattr(chunk.choices[0], 'delta') or not hasattr(chunk.choices[0].delta, 'content') or chunk.choices[0].delta.content is None:
                    continue
                    
                text = chunk.choices[0].delta.content
                total_text += text
                # Check for thinking tags
                if "<think>" in text:
                    in_thinking_section = True
                    parts = text.split("<think>")
                    accumulated_reflection += parts[0]
                    if len(parts) > 1 and parts[1]:
                        thinking_buffer += parts[1]
                        if should_flush_buffer(thinking_buffer):
                            yield {"type": "thinking", "content": flush_buffer()}
                elif "</think>" in text:
                    in_thinking_section = False
                    parts = text.split("</think>")
                    if parts[0]:
                        thinking_buffer += parts[0]
                        # Always flush at the end of a thinking section
                        if thinking_buffer:
                            yield {"type": "thinking", "content": flush_buffer()}
                    accumulated_reflection += parts[1] if len(parts) > 1 else ""
                elif in_thinking_section:
                    thinking_buffer += text
                    if should_flush_buffer(thinking_buffer):
                        yield {"type": "thinking", "content": flush_buffer()}
                else:
                    accumulated_reflection += text
            
            
            # Flush any remaining thinking content
            if thinking_buffer:
                yield {"type": "thinking", "content": flush_buffer()}
            
            # Store the final reflection in messages
            self.messages.append({
                "role": "assistant",
                "content": accumulated_reflection
            })
            
            just_response = re.sub(r'<think>.*?</think>', '', total_text, flags=re.DOTALL)
            # Sanitize the accumulated reflection before parsing as JSON
            sanitized_reflection = self.sanitize_json_text(just_response.strip())
            
            # Try parsing the sanitized reflection as JSON
            try:
                reflection_json = json.loads(sanitized_reflection)
                yield {"type": "reflection", "content": reflection_json}
            except json.JSONDecodeError:
                print("Failed to parse JSON response: " + sanitized_reflection + "\n " + total_text)
                # If JSON parsing fails, try again with a follow-up message
                retry_message = "Your previous response could not be parsed as valid JSON. Please provide a properly formatted JSON response. JUST RETURN THE JSON, NO OTHER TEXT."
                
                self.messages.append({
                    "role": "user",
                    "content": retry_message
                })
                
                retry_response = completion(
                    model=self.model,
                    messages=self.messages,
                )
                
                retry_text = retry_response.choices[0].message.content
                
                # Clean up think tokens from retry response
                retry_text = re.sub(r'<think>.*?</think>', '', retry_text, flags=re.DOTALL)
                
                # Sanitize the retry text before parsing as JSON
                sanitized_retry = self.sanitize_json_text(retry_text)
                
                self.messages.append({
                    "role": "assistant",
                    "content": retry_text
                })
                
                try:
                    retry_json = json.loads(sanitized_retry)
                    yield {"type": "reflection", "content": retry_json}
                except json.JSONDecodeError:
                    yield {"type": "error", "content": "Failed to parse JSON response2: " + sanitized_retry}
        except Exception as e:
            yield {"type": "error", "content": str(e)}
    
    async def start_reflection(self, query: str, summary: str, search_results: str, current_date: str):
        """Start a new reflection conversation and stream responses"""
        # Reset message history
        self.messages = []
        
        # Initialize with system prompt
        self.messages.append({
            "role": "system",
            "content": reflect_system_prompt.substitute(current_date=current_date, query=query)
        })
        
        # Send initial query and search results
        initial_message = f"""
        <summary>
        {summary}
        </summary>
        <search_results>
        {search_results}
        </search_results>
        """
        
        # Use a regular for loop instead of async for
        async for response in self.send(initial_message):
            yield response
