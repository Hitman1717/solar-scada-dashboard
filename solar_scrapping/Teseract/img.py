import easyocr
import os

def extract_text_no_tesseract(image_path, languages=['en']):
    """
    Extracts text from an image using EasyOCR
    """
    # 1. Verify the image file exists
    if not os.path.exists(image_path):
        return f"Error: The file '{image_path}' was not found."
        
    try:
        # 2. Initialize the reader with specified languages
        # The models will automatically download on the first run
        # print("Initializing OCR Reader (this may take a moment on first run)...")
        reader = easyocr.Reader(languages, gpu=False) # Set gpu=True if you have CUDA configured
        
        # 3. Read text from the image
        print(f"Analyzing {image_path}...")
        results = reader.readtext(image_path)
        
        # 4. Extract and combine the text from results
        extracted_lines = []
        for detection in results:
            # detection format: ( [bbox coordinates], "text string", confidence_score )
            text_string = detection[1]
            extracted_lines.append(text_string)
            
        # Join all detected text with newlines
        return "\n".join(extracted_lines)
        
    except Exception as e:
        return f"An error occurred during extraction: {e}"

# RUN THE CODE
if __name__ == "__main__":
    # Replace with your actual image filename
    target_image = "C:/Users/Rohit/OneDrive/Documents/solar_scrapping/Teseract/img.png" 
    
    print("--- Starting Text Extraction ---")
    result_text = extract_text_no_tesseract(target_image, languages=['en'])
    
    print("\n--- Extracted Text ---")
    print(result_text if result_text else "[No text detected in the image]")
