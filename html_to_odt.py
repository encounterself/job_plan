from html.parser import HTMLParser
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(); self.blocks=[]; self.buf=[]; self.kind='p'
    def flush(self):
        text=''.join(self.buf).strip(); self.buf=[]
        if text: self.blocks.append((self.kind,text))
    def handle_starttag(self, tag, attrs):
        if tag in {'h1','h2','h3','p','li','pre','tr'}: self.flush()
        self.kind={'h1':'h1','h2':'h2','h3':'h3','li':'li','pre':'pre'}.get(tag,'p')
        if tag == 'br': self.buf.append('\n')
    def handle_endtag(self, tag):
        if tag in {'h1','h2','h3','p','li','pre','tr'}: self.flush(); self.kind='p'
        elif tag in {'td','th'}: self.buf.append(' | ')
    def handle_data(self, data): self.buf.append(data)
    def close(self): super().close(); self.flush()

def paragraph(kind, text):
    style={'h1':'Title','h2':'Heading_20_2','h3':'Heading_20_3','pre':'Code','li':'List'}.get(kind,'Text')
    return f'<text:p text:style-name="{style}">{escape(text)}</text:p>'

parser=TextExtractor(); parser.feed(Path('databricks-rag-完整实施指南.html').read_text(encoding='utf-8')); parser.close()
body='\n'.join(paragraph(k,t) for k,t in parser.blocks)
content=f'''<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2"><office:automatic-styles><style:style style:name="Title" style:family="paragraph"><style:text-properties fo:font-size="24pt" fo:font-weight="bold"/></style:style><style:style style:name="Heading_20_2" style:family="paragraph"><style:text-properties fo:font-size="16pt" fo:font-weight="bold"/></style:style><style:style style:name="Heading_20_3" style:family="paragraph"><style:text-properties fo:font-size="12pt" fo:font-weight="bold"/></style:style><style:style style:name="Text" style:family="paragraph"><style:text-properties fo:font-size="10pt"/></style:style><style:style style:name="List" style:family="paragraph"><style:paragraph-properties fo:margin-left="0.5in"/><style:text-properties fo:font-size="10pt"/></style:style><style:style style:name="Code" style:family="paragraph"><style:text-properties style:font-name="Liberation Mono" fo:font-size="8pt"/></style:style></office:automatic-styles><office:body><office:text>{body}</office:text></office:body></office:document-content>'''
styles='''<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2"><office:styles><style:default-style style:family="paragraph"><style:text-properties style:font-name="Noto Sans CJK SC" fo:font-size="10pt"/></style:default-style></office:styles></office:document-styles>'''
manifest='''<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/><manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/><manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/></manifest:manifest>'''
with ZipFile('databricks-rag-完整实施指南.odt','w',ZIP_DEFLATED) as z:
    z.writestr('mimetype','application/vnd.oasis.opendocument.text',compress_type=0); z.writestr('content.xml',content); z.writestr('styles.xml',styles); z.writestr('META-INF/manifest.xml',manifest)
