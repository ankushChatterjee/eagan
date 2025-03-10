import json
from litellm import completion
import re
from typing import List, Optional, Dict
from prompts import reflect_system_prompt

class ReflectionSearch:
    def __init__(self, model: str):
        """Initialize reflection search with a specific LLM model"""
        self.model = model
        self.messages: List[Dict[str, str]] = []
        
    def process_llm_response(self, response_text: str) -> str:
        """Process LLM response to extract and print think tags, then return cleaned response"""
        # Find all think tag contents
        think_pattern = r'<think>(.*?)</think>'
        think_matches = re.findall(think_pattern, response_text, re.DOTALL)
        
        # Print thinking process if found
        # if len(think_matches) > 0:
        #     for i, thought in enumerate(think_matches):
        #         print(f"\n================================================\nThinking process {i + 1}:\n{thought.strip()}\n================================================\n")
        
        # Remove think tags and their content
        cleaned_response = re.sub(think_pattern, '', response_text, flags=re.DOTALL)
        return cleaned_response.strip()
    
    def send(self, message: str, role: str = "user") -> Optional[List[str]]:
        """Send a message to the LLM and get the response"""
        self.messages.append({
            "role": role,
            "content": message
        })
        
        response = completion(
            model=self.model,
            messages=self.messages,
        )
        
        response_text = response.choices[0].message.content
        # print("reflect response: ", response_text)
        response_text = self.process_llm_response(response_text)
        
        self.messages.append({
            "role": "assistant",
            "content": response_text
        })
        
        # parse json response
        try:
            response_json = json.loads(response_text)
            return response_json
        except json.JSONDecodeError:
            # If JSON parsing fails, try again with a follow-up message
            # print("JSON parsing failed. Trying again...")
            retry_message = "Your previous response could not be parsed as valid JSON. Please provide a properly formatted JSON response."
            
            self.messages.append({
                "role": "user",
                "content": retry_message
            })
            
            retry_response = completion(
                model=self.model,
                messages=self.messages,
            )
            
            retry_text = retry_response.choices[0].message.content
            # print("retry response: ", retry_text)
            retry_text = self.process_llm_response(retry_text)
            
            self.messages.append({
                "role": "assistant",
                "content": retry_text
            })
            
            # Try parsing the retry response
            try:
                retry_json = json.loads(retry_text)
                return retry_json
            except json.JSONDecodeError:
                # print("JSON parsing failed again after retry.")
                return None

    
    def start_reflection(self, query: str, summary: str, search_results: str, current_date: str) -> Optional[List[str]]:
        """Start a new reflection conversation and return search terms if gaps found"""
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
        response = self.send(initial_message)
        
        return response
