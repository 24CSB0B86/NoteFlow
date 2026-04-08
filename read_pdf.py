import sys
try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf not installed")
    sys.exit(1)

reader = PdfReader("documents/UseCaseFinal.pdf")
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open("pdf_contents.txt", "w", encoding="utf-8") as f:
    f.write(text)
print("Done")
